import Email from '../../../../api/services/Email'
import {
  EMAIL_KINDS,
  EMAIL_TYPES,
  emailTypeFor,
  isValidUnsubscribe
} from '../../../../lib/email/emailTypes'

describe('emailTypes', () => {
  it('names only senders that Email.js has', () => {
    for (const sender of Object.keys(EMAIL_TYPES)) {
      expect(typeof Email[sender], sender).to.equal('function')
    }
  })

  it('gives every line a kind, and an unsubscribe only for bulk email', () => {
    for (const [sender, type] of Object.entries(EMAIL_TYPES)) {
      expect(EMAIL_KINDS, sender).to.include(type.kind)
      if (type.kind === 'essential') {
        expect(type.unsubscribe, sender).to.equal(null)
      } else {
        expect(isValidUnsubscribe(type.unsubscribe), sender).to.equal(true)
      }
    }
  })

  it('keeps password resets, verification and receipts essential', () => {
    for (const sender of ['sendPasswordReset', 'sendEmailVerification', 'sendPurchaseConfirmation', 'sendPaymentFailed']) {
      expect(emailTypeFor(sender).kind).to.equal('essential')
    }
  })

  it("never lets a mention email's one-click switch off the group's post email", () => {
    expect(emailTypeFor('sendPostMentionNotification').unsubscribe).to.equal('settings_page')
  })

  it('accepts a named membership setting as an unsubscribe', () => {
    expect(isValidUnsubscribe('membership_setting:sendEmail')).to.equal(true)
    expect(isValidUnsubscribe('membership_setting:')).to.equal(false)
    expect(isValidUnsubscribe('everything')).to.equal(false)
  })

  it('returns null for a sender it does not know yet', () => {
    expect(emailTypeFor('sendSomethingNew')).to.equal(null)
  })
})
