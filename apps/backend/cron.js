require('@babel/register')
const skiff = require('./lib/skiff') // this must be required first
const { DateTime } = require('luxon')
const sentry = require('./lib/sentry')
sentry.setProcess('cron')
const sails = skiff.sails
const digest2 = require('./lib/group/digest2')
const Promise = require('bluebird')
const { red } = require('chalk')
const savedSearches = require('./lib/group/digest2/savedSearches')
const { savedSearchDigestTypesAt } = require('./lib/group/digest2/localMorning')
const OIDCAdapter = require('./api/services/oidc/KnexAdapter')
const { countOrphanedGroups } = require('./api/models/group/administrators')

// D41: each hourly run sends to members whose local morning (or, without a timezone,
// noon Pacific) has come round; the daily and weekly runs pick their own members
const sendAndLogDigests = (type, now) =>
  digest2.sendAllDigests(type, { at: now.toJSDate() })
    .then(results => { sails.log.debug(`Sent ${type} digests for: ${results}`); return results })
    .catch(err => {
      sails.log.error(`${type} digest run failed; continuing hourly tasks`, err)
      return []
    })

const sendSavedSearchDigests = userId =>
  savedSearches.sendAllDigests(userId)

const resendInvites = () =>
  Invitation.resendAllReady()
    .then(results => { sails.log.debug(`Resent the following invites: ${results}`); return results })

const daily = now => {
  const tasks = []

  sails.log.debug('Removing old kue jobs')
  tasks.push(Queue.removeOldJobs('complete', 20000))
  tasks.push(Queue.removeOldJobs('failed', 20000, 7).then(count => sails.log.debug(`Removed ${count} failed kue jobs`)))

  sails.log.debug('Removing old notifications')
  tasks.push(Notification.removeOldNotifications())

  sails.log.debug('Checking funding round reminders')
  tasks.push(FundingRound.sendReminderNotifications().then(count => sails.log.debug(`Sent ${count} funding round reminder notifications`)))

  sails.log.debug('Sending subscription renewal reminders')
  tasks.push(ContentAccess.sendRenewalReminders().then(count => sails.log.debug(`Sent ${count} subscription renewal reminder emails`)))

  sails.log.debug('Sending expired access notifications')
  tasks.push(ContentAccess.sendExpiredAccessNotifications().then(count => sails.log.debug(`Sent ${count} expired access notification emails`)))

  sails.log.debug('Building the sitemap of listed Public groups and their public posts')
  /* global Sitemap */
  tasks.push(Sitemap.generate()
    .then(count => sails.log.debug(`Sitemap lists ${count} URLs`))
    .catch(err => {
      // The sitemap is optional; a failure here must not stop the other daily tasks
      sails.log.error('Sitemap build failed; continuing daily tasks', err)
      sentry.error(err)
      return 0
    }))

  sails.log.debug('Cleaning up expired OIDC payloads')
  tasks.push(OIDCAdapter.cleanupExpired().then(count => {
    sails.log.debug(`Removed ${count} expired OIDC payloads`)
    return count
  }))

  tasks.push(require('./api/models/group/activityBenchmark').runDaily().then(({ line, marked }) => sails.log.debug(`Marked ${marked} groups quiet or busy (line: ${line} feed posts in 28 days)`)).catch(err => sails.log.error('Quiet-group benchmark failed', err)))

  tasks.push(require('./api/models/user/winback').sendWinbackEmails().then(count => sails.log.debug(`Sent ${count} win-back emails`)).catch(err => sails.log.error('Win-back emails failed', err)))

  // Staff assign an Administrator from Management > Groups without an Administrator
  tasks.push(countOrphanedGroups().then(count => {
    sails.log.info(`metric groups_without_administrator=${count}`)
    return count
  }))

  // One nudge to authors of requests and offers nobody has answered after about 3 days (D58)
  tasks.push(require('./api/models/post/openRequestNudge').sendOpenRequestNudges().then(count => sails.log.debug(`Sent ${count} open request nudges`)).catch(err => sails.log.error('Open request nudges failed', err)))

  // Reminders to learners idle in a track for 7 and 21 days, at most two per enrollment (D63)
  tasks.push(require('./api/models/track/reminders').sendTrackReminders().then(count => sails.log.debug(`Sent ${count} track reminders`)).catch(err => sails.log.error('Track reminders failed', err)))
  // D13/D14: 14-day join request notes, quiet-group prompts and, on Mondays, the steward email
  tasks.push(require('./lib/group/stewardDigest').runDaily({ now: now.toJSDate(), weekday: now.weekday }).then(({ unanswered, quiet, weekly }) => sails.log.debug(`Steward job: ${unanswered} unanswered join requests, ${quiet} quiet groups, ${weekly.emails} steward emails in ${weekly.groups} groups`)).catch(err => sails.log.error('Steward job failed', err)))

  // D49 experiment: nudge stewards about newcomers' first posts with no response after a day
  tasks.push(require('./api/models/post/firstPostNudge').runDaily().then(({ found, nudged, control }) => sails.log.debug(`First posts without a response: ${found} (${nudged} nudged, ${control} control)`)).catch(err => sails.log.error('First-post nudge failed', err)))

  // D38: on Mondays, "N people joined this week, say hi" to recently active members
  if (now.weekday === 1) {
    tasks.push(require('./api/models/group/newcomerBatch').runWeekly().then(({ groups, notices }) => sails.log.debug(`Sent ${notices} new-member notices in ${groups} groups`)).catch(err => sails.log.error('New-member notices failed', err)))
  }

  return tasks
}

const hourly = now => {
  const tasks = [
    GroupViewUser.sendDigests()
      .then(count => sails.log.debug(`Sent ${count} chat digests`))
      .catch(err => {
        sails.log.error('Chat digest job failed; continuing hourly tasks', err)
        return 0
      })
  ]
  tasks.push(require('./api/models/invitation/stalledSignupReminder').sendStalledSignupReminders().then(count => sails.log.debug(`Sent ${count} stalled signup reminders`)).catch(err => sails.log.error('Stalled signup reminders failed', err)))
  // D44: reminders about a day before events, and nudges to unanswered invitees
  tasks.push(require('./api/models/event/reminders').sendEventReminders().then(({ events, reminded, nudged }) => sails.log.debug(`Event reminders: ${events} events, ${reminded} reminded, ${nudged} nudged`)).catch(err => sails.log.error('Event reminders failed', err)))

  sails.log.debug('Sending digests to members whose local morning has come round')
  tasks.push(sendAndLogDigests('daily', now))
  tasks.push(sendAndLogDigests('weekly', now))
  // Saved-search digests stay at noon Pacific, weekly ones on Wednesday
  for (const type of savedSearchDigestTypesAt(now)) {
    sails.log.debug(`Sending ${type} saved search digests`)
    tasks.push(sendSavedSearchDigests(type))
  }

  switch (now.hour) {
    case 13:
      sails.log.debug('Resending invites')
      tasks.push(resendInvites())
      break
  }

  return tasks
}

const every10minutes = now => {
  sails.log.debug('Refreshing full-text search index, sending unsent notifications and comment digests, updating member counts, updating proposal statuses, and checking funding round phase transitions')
  return [
    FullTextSearch.refreshView(),
    // Retries failed notifications; claimUnsentIds skips rows a worker job has locked.
    Notification.sendUnsent(),
    Comment.sendDigests().then(count => sails.log.debug(`Sent ${count} comment/message digests`)),
    Group.updateAllMemberCounts(),
    // D46: proposals whose voting just ended, and ones closing soon (post/proposalNotices)
    Post.updateProposalStatuses()
      .then(completedIds => require('./api/models/post/proposalNotices').sendProposalNotices({ completedIds }))
      .then(({ closed, closingSoon }) => sails.log.debug(`Sent ${closed} proposal closed and ${closingSoon} closing soon notices`))
      .catch(err => sails.log.error('Proposal notices failed', err)),
    FundingRound.checkPhaseTransitions().then(count => sails.log.debug(`Sent ${count} funding round phase transition notifications`))
  ]
}

const runJob = Promise.method(name => {
  const job = { hourly, daily, every10minutes }[name]
  if (typeof job !== 'function') {
    throw new Error(`Unknown job name: "${name}"`)
  }
  sails.log.debug(`Running ${name} job`)
  const now = DateTime.now().setZone('America/Los_Angeles')
  return Promise.all(job(now))
})

skiff.lift({
  start: function (argv) {
    runJob(argv.interval)
      .then(function () {
        skiff.lower()
      })
      .catch(function (err) {
        sails.log.error(red(err.message))
        sails.log.error(err)
        sentry.error(err, () => skiff.lower())
      })
  }
})
