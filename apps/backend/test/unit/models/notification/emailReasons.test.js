import '../../../setup'
import { EMAIL_REASONS } from '../../../../api/models/notification/emailReasons'
import { PRIORITY_REASONS } from '../../../../api/models/notification/priorityReasons'

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
  it('lists only priority reasons', () => {
    for (const reason of EMAIL_REASONS) {
      expect(Notification.priorityReason([reason])).to.equal(reason)
    }
  })

  for (const label of PRIORITY_REASONS) {
    it(`matches whether Notification#sendEmail sends an email for '${label}'`, async () => {
      const hasEmail = EMAIL_REASONS.has(Notification.priorityReason([label]))

      const { notification, spies } = notificationWithStubbedEmails(label)
      await notification.sendEmail()
      const called = Object.values(spies).filter(s => s.__spy.called)
      expect(called).to.have.length(hasEmail ? 1 : 0)
    })
  }
})
