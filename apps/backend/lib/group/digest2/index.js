import { compact, groupBy, merge, startCase } from 'lodash'
import sampleData from './sampleData.json'
import formatData from './formatData'
import personalizeData from './personalizeData'
import { mergeDigestData } from './mergeData'
import {
  defaultTimeRange,
  getPostsAndComments,
  getRecipients,
  shouldSendData
} from './util'
import { senderNameViaHylo } from '../../email/senderNameViaHylo'
import { getLocaleStrings } from '../../i18n/locales'
import { lastSeenAt } from '../../../api/models/notification/rules/inactiveReader'
import { settleWeeklyDigestNotice } from './weeklyNotice'
import { openRequestsForDigest } from './openRequests'
import { claimSlot, dueTimezones, groupIdsWithDueMembers, markSlots, releaseSlot } from './localMorning'
import sentry from '../../sentry'

const DIGEST_TEMPLATE_ID = 'tem_t7rmGfJKvqXrvmrVWJjjWkg4'
const SAVED_SEARCH_TEMPLATE_ID = 'tem_yfgPbhVHbRHYpy6Dc3hgKjcX'

// Each group load fans out into several relation queries, and the noon cron can
// run the daily and weekly digests at the same time. Stay under the knex pool
// (max 30) so those jobs do not time out waiting for a connection.
const DIGEST_GROUP_CONCURRENCY = 2
const DIGEST_USER_CONCURRENCY = 5

const timePeriod = type => {
  switch (type) {
    case 'daily': return 'day'
    case 'weekly': return 'week'
  }
}

export const prepareDigestData = async (id, type, opts = {}) => {
  let startTime = opts.startTime
  let endTime = opts.endTime
  if (!opts.startTime) {
    const range = defaultTimeRange(type)
    startTime = range[0]
    endTime = range[1]
  }
  const group = await Group.find(id)
  const spacesCollection = await group.spaces().query(q => q.where('active', true)).fetch()
  const spaces = spacesCollection.models
  spaces.forEach(space => {
    space.relations.parentGroup = group
  })
  const data = await getPostsAndComments(group, startTime, endTime, type, spaces)
  if (!data) return false
  data.openRequests = await openRequestsForDigest(group, spaces, startTime)
  const formattedData = await formatData(group, data)
  return merge({
    group_id: group.id,
    group_name: group.get('name'),
    group_avatar_url: group.get('avatar_url'),
    group_slug: group.get('slug'),
    group_url: Frontend.Route.group(group),
    time_period: timePeriod(type)
  }, formattedData)
}

// The first weekly digest after someone's daily digest was slowed down for being away
// (util.js marks them digestSlowed) says so, once per absence (D9). The template shows
// slowed_notice when it is set.
const SLOWED_NOTICE_SETTING = 'digest_slowed_notice_at'
// Someone in several groups gets several weekly digests in one run; only one says it
const slowedNoticeSentTo = new Set()

function owesSlowedNotice (user, type) {
  if (type !== 'weekly' || !user.digestSlowed || slowedNoticeSentTo.has(String(user.id))) return false
  const noticedAt = user.get('settings')?.[SLOWED_NOTICE_SETTING]
  const seen = lastSeenAt(user)
  return !noticedAt || (seen && new Date(noticedAt) < seen)
}

const recordSlowedNotice = user => bookshelf.knex('users')
  .where({ id: user.id })
  .update({ settings: bookshelf.knex.raw('coalesce(settings, \'{}\'::jsonb) || ?::jsonb', [JSON.stringify({ [SLOWED_NOTICE_SETTING]: new Date().toISOString() })]) })

// How one digest to one person went: sent, nothing left to send after personalizing,
// skipped by Email.js (unsubscribe choice or undeliverable address), failed, or a dry run
export const DIGEST_OUTCOME = {
  SENT: 'sent',
  NOTHING: 'nothing',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  DRY_RUN: 'dry_run'
}

const outcomeOfSend = result => result === false
  ? DIGEST_OUTCOME.FAILED
  : result === Email.SKIPPED ? DIGEST_OUTCOME.SKIPPED : DIGEST_OUTCOME.SENT

export const sendToUser = (user, type, data, opts = {}) =>
  deliverDigest(user, type, data, opts).then(({ result }) => result)

// sendToUser, also saying how it went ({ outcome, result })
export const deliverDigest = (user, type, data, opts = {}) => {
  const templateId = data.search ? SAVED_SEARCH_TEMPLATE_ID : DIGEST_TEMPLATE_ID
  let senderName
  if (data.search) {
    senderName = data.context === 'all' ? 'All My Groups' : data.context === 'public' ? 'Public' : data.group_name
    senderName += ' Saved Search'
  } else if (data.unified) {
    senderName = type === 'weekly' ? 'Hylo Weekly Digest' : 'Hylo Daily Digest'
  } else {
    senderName = `${data.group_name} ${startCase(type)} Digest`
  }

  // What a one-click unsubscribe from this digest turns off (D34): that group's digest,
  // or for the unified digest every group on this frequency; a saved search links to
  // the settings page. A weekly unified digest to someone whose daily digest was slowed
  // down for being away also carries their daily groups, so its one-click covers those.
  const unsubscribe = data.search
    ? { descriptor: 'settings_page' }
    : data.unified
      ? { frequency: type, ...(type === 'weekly' && user.digestSlowed ? { slowedDaily: true } : {}) }
      : { groupId: data.group_id }

  // Claimed before sending, so digests from two groups sent at the same time can't
  // both carry it; released again if this one doesn't go out
  const slowedNotice = !data.search && owesSlowedNotice(user, type)
  if (slowedNotice) slowedNoticeSentTo.add(String(user.id))
  let slowedNoticeSent = false

  return personalizeData(user, type, data, opts)
    .then(async data => {
      if (!data) return { outcome: DIGEST_OUTCOME.NOTHING, result: false }
      if (opts.dryRun) return { outcome: DIGEST_OUTCOME.DRY_RUN, result: true }
      const locale = user.getLocale()
      const emailData = slowedNotice
        ? { ...data, slowed_notice: getLocaleStrings(locale).emailDigestSlowedNotice() }
        : data
      // Clears the weekly-digest notice once the digest carrying it has gone out (D73)
      const result = await settleWeeklyDigestNotice(user, data, () => Email.sendSimpleEmail(user.get('email'), templateId, emailData, {
        sender: {
          name: senderNameViaHylo(senderName, locale),
          reply_to: 'DoNotReply@hylo.com'
        },
        version: 'Spaces',
        unsubscribe
      }, locale))
      if (slowedNotice && result && result !== Email.SKIPPED) {
        slowedNoticeSent = true
        await recordSlowedNotice(user)
      }
      return { outcome: outcomeOfSend(result), result }
    })
    .finally(() => {
      if (slowedNotice && !slowedNoticeSent) slowedNoticeSentTo.delete(String(user.id))
    })
}

// One failing recipient must not stop the rest of the group's digest
const sendToEach = async (users, type, data, opts, groupId) => {
  let sent = 0
  for (const user of users) {
    try {
      if (await sendToUser(user, type, data, opts) !== false) sent += 1
    } catch (err) {
      sails.log.error(`digest2: error sending ${type} digest for group ${groupId} to user ${user.id}: ${err.message}`, err.stack)
      sentry.error(err, null, { groupId, userId: user.id, type })
    }
  }
  return sent
}

export const sendDigest = (id, type, opts = {}) => {
  return prepareDigestData(id, type, opts).then(data =>
    shouldSendData(data, id)
      .then(ok => ok && getRecipients(id, type)
        .then(users => sendToEach(users, type, data, opts, id))))
}

/** True when this person asked for one digest per frequency instead of one per group. */
const wantsUnifiedDigest = user => user.get('settings')?.unified_email_digest === true

/**
 * Send one digest covering every group in `datasets` for this frequency.
 */
export const sendUnifiedToUser = (user, type, datasets, opts = {}) =>
  deliverUnifiedDigest(user, type, datasets, opts).then(({ result }) => result)

const deliverUnifiedDigest = (user, type, datasets, opts = {}) => {
  const merged = mergeDigestData(datasets)
  if (!merged) return Promise.resolve({ outcome: DIGEST_OUTCOME.NOTHING, result: false })
  const data = merge(merged, {
    unified: true,
    group_id: null,
    group_name: 'Hylo',
    group_avatar_url: null,
    group_slug: null,
    group_url: Frontend.Route.root(),
    time_period: timePeriod(type)
  })
  return deliverDigest(user, type, data, opts)
}

// Sends every group's digest of this type. With opts.at (the hourly cron's run time),
// sends only to members whose local-morning slot has come round (D41, localMorning.js);
// without it, to every recipient for the default window or opts.startTime/endTime.
export const sendAllDigests = async (type, opts = {}) => {
  if (opts.groupIds && opts.groupIds.length === 0) return []
  slowedNoticeSentTo.clear()
  if (opts.at) return sendScheduledDigests(type, opts)

  let query = bookshelf.knex('groups')
    .where({ active: true })
    .where(function () {
      this.whereNull('type').orWhere('type', '<>', 'space')
    })
  if (opts.groupIds) {
    query = query.whereIn('id', opts.groupIds)
  }

  const ids = await query.pluck('id')
  const unifiedByUserId = new Map()

  // A failure in one group (or for one person) is logged and skipped so the rest still go out
  const results = await Promise.map(ids, async id => {
    try {
      const data = await prepareDigestData(id, type, opts)
      if (!data || !(await shouldSendData(data, id))) return null

      const users = await getRecipients(id, type)
      const regular = []
      users.forEach(user => {
        if (wantsUnifiedDigest(user)) {
          const bucket = unifiedByUserId.get(user.id) || { user, datasets: [] }
          bucket.datasets.push(data)
          // Slowed down in any group: the weekly unified digest carries that group too
          if (user.digestSlowed) bucket.user.digestSlowed = true
          unifiedByUserId.set(user.id, bucket)
        } else {
          regular.push(user)
        }
      })

      const sent = await sendToEach(regular, type, data, opts, id)
      return sent ? [id, sent] : null
    } catch (err) {
      sails.log.error(`digest2: error sending ${type} digests for group ${id}: ${err.message}`, err.stack)
      sentry.error(err, null, { groupId: id, type })
      return null
    }
  }, { concurrency: DIGEST_GROUP_CONCURRENCY })

  await Promise.map([...unifiedByUserId.values()], async ({ user, datasets }) => {
    try {
      await sendUnifiedToUser(user, type, datasets, opts)
    } catch (err) {
      sails.log.error(`digest2: error sending unified ${type} digest to user ${user.id}: ${err.message}`, err.stack)
      sentry.error(err, null, { userId: user.id, type })
    }
  }, { concurrency: DIGEST_USER_CONCURRENCY })

  return compact(results)
}

// One digest each, for members whose slot is due. The slot is claimed first, so a second
// run can't send it again, and given back if the send fails, so a later run retries.
const sendScheduledToEach = async (users, type, data, opts, groupId) => {
  let sent = 0
  for (const user of users) {
    if (!opts.dryRun && !(await claimSlot(groupId, user.id, type, user.digestSlot))) continue
    try {
      const { outcome } = await deliverDigest(user, type, data, opts)
      if (outcome === DIGEST_OUTCOME.FAILED && !opts.dryRun) {
        await releaseSlot(groupId, user.id, type, user.digestSlot, user.digestSentFor)
      }
      if (outcome === DIGEST_OUTCOME.SENT || outcome === DIGEST_OUTCOME.DRY_RUN) sent += 1
    } catch (err) {
      if (!opts.dryRun) await releaseSlot(groupId, user.id, type, user.digestSlot, user.digestSentFor)
      sails.log.error(`digest2: error sending ${type} digest for group ${groupId} to user ${user.id}: ${err.message}`, err.stack)
      sentry.error(err, null, { groupId, userId: user.id, type })
    }
  }
  return sent
}

// A unified digest to one member: claims each group's slot, sends what it could claim,
// and gives the claims back if the send fails
const sendScheduledUnified = async ({ user, datasets }, type, opts) => {
  const claimed = []
  for (const data of datasets) {
    if (opts.dryRun || await claimSlot(data.group_id, user.id, type, user.digestSlot)) claimed.push(data)
  }
  if (claimed.length === 0) return
  const release = () => opts.dryRun
    ? null
    : Promise.all(claimed.map(data => releaseSlot(data.group_id, user.id, type, user.digestSlot, user.digestSentForByGroup?.[String(data.group_id)])))
  try {
    const { outcome } = await deliverUnifiedDigest(user, type, claimed, opts)
    if (outcome === DIGEST_OUTCOME.FAILED) await release()
  } catch (err) {
    await release()
    throw err
  }
}

// D41: one hourly run. Only groups with a member whose slot is due are prepared, once
// for each distinct window among those members (on most days there is one).
const sendScheduledDigests = async (type, opts) => {
  const at = opts.at
  const timezones = await dueTimezones(type, at)
  const ids = await groupIdsWithDueMembers(type, timezones, opts.groupIds)
  const unifiedByUserId = new Map()

  const results = await Promise.map(ids, async id => {
    try {
      const users = await getRecipients(id, type, { at, timezones })
      if (users.length === 0) return null
      let sent = 0
      for (const windowUsers of Object.values(groupBy(users, user => user.digestWindowKey))) {
        const [startTime, endTime] = windowUsers[0].digestWindow
        const data = await prepareDigestData(id, type, { ...opts, startTime, endTime })
        if (!data || !(await shouldSendData(data, id))) {
          // Nothing in this group for them today: done for this slot
          if (!opts.dryRun) await markSlots(id, type, windowUsers.map(user => ({ userId: user.id, slot: user.digestSlot })))
          continue
        }
        const regular = []
        windowUsers.forEach(user => {
          if (wantsUnifiedDigest(user)) {
            const bucket = unifiedByUserId.get(user.id) || { user, datasets: [] }
            bucket.datasets.push(data)
            bucket.user.digestSentForByGroup = { ...bucket.user.digestSentForByGroup, [String(id)]: user.digestSentFor }
            if (user.digestSlowed) bucket.user.digestSlowed = true
            unifiedByUserId.set(user.id, bucket)
          } else {
            regular.push(user)
          }
        })
        sent += await sendScheduledToEach(regular, type, data, opts, id)
      }
      return sent ? [id, sent] : null
    } catch (err) {
      sails.log.error(`digest2: error sending ${type} digests for group ${id}: ${err.message}`, err.stack)
      sentry.error(err, null, { groupId: id, type })
      return null
    }
  }, { concurrency: DIGEST_GROUP_CONCURRENCY })

  await Promise.map([...unifiedByUserId.values()], async bucket => {
    try {
      await sendScheduledUnified(bucket, type, opts)
    } catch (err) {
      sails.log.error(`digest2: error sending unified ${type} digest to user ${bucket.user.id}: ${err.message}`, err.stack)
      sentry.error(err, null, { userId: bucket.user.id, type })
    }
  }, { concurrency: DIGEST_USER_CONCURRENCY })

  return compact(results)
}

export const sendSampleData = address =>
  Email.sendSimpleEmail(address, DIGEST_TEMPLATE_ID, sampleData, { version: 'Spaces' })
