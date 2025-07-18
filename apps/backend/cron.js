require('@babel/register')
const skiff = require('./lib/skiff') // this must be required first
const { DateTime } = require('luxon')
const rollbar = require('./lib/rollbar')
const sails = skiff.sails
const digest2 = require('./lib/group/digest2')
const Promise = require('bluebird')
const { red } = require('chalk')
const savedSearches = require('./lib/group/digest2/savedSearches')

const sendAndLogDigests = type =>
  digest2.sendAllDigests(type)
    .then(results => { sails.log.debug(`Sent digests for: ${results}`); return results })

const sendSavedSearchDigests = userId =>
  savedSearches.sendAllDigests(userId)

const resendInvites = () =>
  Invitation.resendAllReady()
    .then(results => { sails.log.debug(`Resent the following invites: ${results}`); return results })

const daily = now => {
  const tasks = []

  sails.log.debug('Removing old kue jobs')
  tasks.push(Queue.removeOldJobs('complete', 20000))

  sails.log.debug('Removing old notifications')
  tasks.push(Notification.removeOldNotifications())

  switch (now.day) {
    case 3:
      sails.log.debug('Sending weekly digests')
      tasks.push(sendAndLogDigests('weekly'))
      tasks.push(sendSavedSearchDigests('weekly'))
      break
  }
  return tasks
}

const hourly = now => {
  const tasks = []

  switch (now.hour) {
    case 12:
      sails.log.debug('Sending daily digests')
      tasks.push(sendAndLogDigests('daily'))
      tasks.push(sendSavedSearchDigests('daily'))
      break
    case 13:
      sails.log.debug('Resending invites')
      tasks.push(resendInvites())
      break
  }

  return tasks
}

const every10minutes = now => {
  sails.log.debug('Refreshing full-text search index, sending comment digests, updating member counts, and updating proposal statuses')
  return [
    FullTextSearch.refreshView(),
    Comment.sendDigests().then(count => sails.log.debug(`Sent ${count} comment/message digests`)),
    TagFollow.sendDigests().then(count => sails.log.debug(`Sent ${count} chat room digests`)),
    Group.updateAllMemberCounts(),
    Post.updateProposalStatuses()
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
        rollbar.error(err, () => skiff.lower())
      })
  }
})
