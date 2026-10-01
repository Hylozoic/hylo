import { compact, merge, startCase } from 'lodash'
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

export const sendToUser = (user, type, data, opts = {}) => {
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

  return personalizeData(user, type, data, opts)
    .then(data => {
      const locale = user.getLocale()
      return opts.dryRun || !data
        ? false
        : Email.sendSimpleEmail(user.get('email'), templateId, data, {
          sender: {
            name: senderNameViaHylo(senderName, locale),
            reply_to: 'DoNotReply@hylo.com'
          },
          version: 'Spaces'
        }, locale)
    })
}

export const sendDigest = (id, type, opts = {}) => {
  return prepareDigestData(id, type, opts).then(data =>
    shouldSendData(data, id)
      .then(ok => ok && getRecipients(id, type)
        .then(users => Promise.each(users, user => sendToUser(user, type, data, opts)))
        .then(users => users.length)))
}

/** True when this person asked for one digest per frequency instead of one per group. */
const wantsUnifiedDigest = user => user.get('settings')?.unified_email_digest === true

/**
 * Send one digest covering every group in `datasets` for this frequency.
 */
export const sendUnifiedToUser = (user, type, datasets, opts = {}) => {
  const merged = mergeDigestData(datasets)
  if (!merged) return Promise.resolve(false)
  const data = merge(merged, {
    unified: true,
    group_id: null,
    group_name: 'Hylo',
    group_avatar_url: null,
    group_slug: null,
    group_url: Frontend.Route.root(),
    time_period: timePeriod(type)
  })
  return sendToUser(user, type, data, opts)
}

export const sendAllDigests = async (type, opts = {}) => {
  if (opts.groupIds && opts.groupIds.length === 0) return []

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

  const results = await Promise.map(ids, async id => {
    const data = await prepareDigestData(id, type, opts)
    if (!data || !(await shouldSendData(data, id))) return null

    const users = await getRecipients(id, type)
    const regular = []
    users.forEach(user => {
      if (wantsUnifiedDigest(user)) {
        const bucket = unifiedByUserId.get(user.id) || { user, datasets: [] }
        bucket.datasets.push(data)
        unifiedByUserId.set(user.id, bucket)
      } else {
        regular.push(user)
      }
    })

    await Promise.each(regular, user => sendToUser(user, type, data, opts))
    return regular.length ? [id, regular.length] : null
  }, { concurrency: DIGEST_GROUP_CONCURRENCY })

  await Promise.map([...unifiedByUserId.values()], ({ user, datasets }) =>
    sendUnifiedToUser(user, type, datasets, opts), { concurrency: DIGEST_USER_CONCURRENCY })

  return compact(results)
}

export const sendSampleData = address =>
  Email.sendSimpleEmail(address, DIGEST_TEMPLATE_ID, sampleData, { version: 'Spaces' })
