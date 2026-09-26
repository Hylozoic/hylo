import '../../../setup'
import { EMAIL_REASONS } from '../../../../api/models/notification/emailReasons'

// Replaces every send*Email method on a notification with a spy, so sendEmail can be
// called without loading anything, and returns the spies.
function notificationWithStubbedEmails (reason) {
  const notification = Notification.forge({ medium: Notification.MEDIUM.Email })
  notification.relations.activity = Activity.forge({ meta: { reasons: [reason] } })
  const senders = Object.keys(Notification.prototype)
    .filter(key => /^send.+Email$/.test(key))
  const spies = {}
  for (const key of senders) {
    spies[key] = spy(() => Promise.resolve())
    notification[key] = spies[key]
  }
  return { notification, spies }
}

describe('EMAIL_REASONS', () => {
  for (const reason of EMAIL_REASONS) {
    it(`matches an email that Notification#sendEmail sends for '${reason}'`, async () => {
      expect(Notification.priorityReason([reason])).to.equal(reason)

      const { notification, spies } = notificationWithStubbedEmails(reason)
      await notification.sendEmail()
      const called = Object.values(spies).filter(s => s.__spy.called)
      expect(called).to.have.length(1)
    })
  }

  for (const reason of ['newComment', 'commentMention', 'newContribution', 'voteReset', 'chat', 'follow', 'followAdd', 'unfollow']) {
    it(`leaves out '${reason}', which Notification#sendEmail has no email for`, async () => {
      expect(EMAIL_REASONS.has(reason)).to.equal(false)

      const { notification, spies } = notificationWithStubbedEmails(reason)
      await notification.sendEmail()
      const called = Object.values(spies).filter(s => s.__spy.called)
      expect(called).to.have.length(0)
    })
  }
})
