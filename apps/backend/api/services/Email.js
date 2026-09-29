import { AsyncLocalStorage } from 'async_hooks'
import { curry, merge, uniq } from 'lodash'
import { format } from 'util'
import { normalizeLocaleToFull } from '../../lib/localeHelpers'
import { senderNameViaHylo } from '../../lib/email/senderNameViaHylo'
import { emailTypeFor } from '../../lib/email/emailTypes'
import { confirmPageUrl, createUnsubscribeToken, oneClickUrl } from '../../lib/email/unsubscribeToken'
import { scopeAllowsBulkEmail, unsubscribeScopeOf } from '../models/notification/rules/unsubscribeScope'
import sentry from '../../lib/sentry'

const api = require('sendwithus')(process.env.SENDWITHUS_KEY)

// Resolves false on failure rather than rejecting: callers treat `false` as "not sent".
// Failures are reported without the recipient address or email data.
const sendEmail = opts =>
  new Promise((resolve, reject) =>
    api.send(opts, (err, resp) => err ? reject(err) : resolve(resp)))
    .then((resp) => {
      return resp || true
    })
    .catch(err => {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(`Error sending email ${opts.email_id}: ${error.message}`)
      sentry.error(error, null, {
        templateId: opts.email_id,
        versionName: opts.version_name,
        locale: opts.locale,
        statusCode: error.statusCode
      })
      return false
    })

// Which exported sender is running (see the end of this file), so the shared send path
// can read its line in lib/email/emailTypes.js without every sender passing it along
const currentSender = new AsyncLocalStorage()

// What a send resolves to when Hylo decides not to send it: the recipient's unsubscribe
// choice rules it out. Not `false`, which callers read as a failed send to retry.
const SKIPPED = Object.freeze({ skipped: true })

const TRANSPORT = { BULK: 'bulk', TRANSACTIONAL: 'transactional' }

// The Hylo account an address belongs to (both spellings hit the unique email index)
async function recipientFor (address) {
  if (!address || typeof address !== 'string') return null
  const rows = await bookshelf.knex('users')
    .select('id', 'settings')
    .whereIn('email', uniq([address, address.toLowerCase()]))
    .limit(1)
  return rows[0] || null
}

// Group-scoped descriptors need a group (or, for the unified digest, a frequency);
// without one the email links to the settings page instead
function unsubscribeDescriptor (type, context) {
  const descriptor = context?.descriptor || type?.unsubscribe || 'settings_page'
  const [kind] = descriptor.split(':')
  if (kind === 'group_digest' && !context?.groupId && !context?.frequency) return 'settings_page'
  if (kind === 'group_post_email' && !context?.groupId) return 'settings_page'
  return descriptor
}

// Tags go to SendWithUs, which passes them to the email provider (categories), so the
// provider's events can say what kind of email a bounce or complaint was about (D36)
function emailTags (senderName, context) {
  return [
    senderName && `hylo_type:${senderName}`,
    context?.groupId && `hylo_group:${context.groupId}`
  ].filter(Boolean)
}

// List-Unsubscribe on bulk email only (D34). Carries only the token. A descriptor with a
// switch gets RFC 8058 one-click and an unsubscribe_url for the template's footer link;
// settings_page gets a link to the confirmation page, which points to the settings page.
function addUnsubscribe (emailOpts, { senderName, type, recipient, context }) {
  const descriptor = unsubscribeDescriptor(type, context)
  const token = createUnsubscribeToken({
    userId: recipient.id,
    sender: senderName,
    descriptor,
    groupId: descriptor === 'settings_page' ? null : context?.groupId,
    frequency: context?.frequency
  })
  if (!token) return
  emailOpts.headers = { ...emailOpts.headers, 'List-Unsubscribe': `<${oneClickUrl(token)}>` }
  if (descriptor !== 'settings_page') {
    emailOpts.headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    emailOpts.email_data = { ...emailOpts.email_data, unsubscribe_url: confirmPageUrl(token) }
  }
}

// Every send goes through here. `context` (optional, never sent to SendWithUs):
//   groupId     the group the email is about, for a one-click that applies to a group
//   frequency   'daily' or 'weekly', for the unified digest's one-click
//   descriptor  overrides the sender's unsubscribe descriptor for this send
async function deliver (transport, emailOpts, context = {}) {
  const senderName = currentSender.getStore() || null
  const type = senderName ? emailTypeFor(senderName) : null
  // A sender not in emailTypes.js yet is essential when it's sent as transactional
  const essential = type ? type.kind === 'essential' : transport === TRANSPORT.TRANSACTIONAL

  emailOpts.tags = emailTags(senderName, context)

  if (!essential) {
    const recipient = await recipientFor(emailOpts.recipient?.address)
    if (recipient) {
      if (!scopeAllowsBulkEmail(unsubscribeScopeOf(recipient.settings), type)) return SKIPPED
      if (transport === TRANSPORT.BULK) addUnsubscribe(emailOpts, { senderName, type, recipient, context })
    }
  }

  return sendEmail(emailOpts)
}

const sender = {
  address: process.env.EMAIL_SENDER,
  name: 'The Team at Hylo'
}

const bulkOptions = {
  sender,
  locale: 'en-US',
  headers: {
    Precedence: 'bulk',
    'X-Auto-Response-Suppress': 'All'
  }
}

// Account emails and receipts must not say `Precedence: bulk`. Built separately
// because merging over bulkOptions cannot remove that header.
const transactionalOptions = {
  sender,
  locale: 'en-US',
  headers: {
    'X-Auto-Response-Suppress': 'All'
  }
}

// extraOptions.unsubscribe is the send's context for deliver(), not a SendWithUs option
const simpleEmailSender = (baseOptions, transport) => (address, templateId, data, extraOptions, locale = 'en-US') => {
  const { unsubscribe: context, ...options } = extraOptions || {}
  const emailOpts = merge({}, baseOptions, {
    email_id: templateId,
    recipient: { address },
    email_data: data,
    locale: normalizeLocaleToFull(locale)
  }, options)
  if (emailOpts.version) {
    emailOpts.version_name = emailOpts.version
    delete emailOpts.version
  }
  return deliver(transport, emailOpts, context)
}

const sendSimpleEmail = simpleEmailSender(bulkOptions, TRANSPORT.BULK)
const sendTransactionalSimpleEmail = simpleEmailSender(transactionalOptions, TRANSPORT.TRANSACTIONAL)

// opts.unsubscribe is the send's context for deliver()
const emailWithOptionsSender = (baseOptions, transport) => curry((templateId, opts) => {
  const emailOpts = merge({}, baseOptions, {
    email_id: templateId,
    recipient: { address: opts.email },
    email_data: opts.data,
    locale: normalizeLocaleToFull(opts.locale),
    sender: opts.sender, // expects {name, reply_to}
    files: opts.files
  })

  // Only include version_name if provided (SendWithUs will use most recent published version if not specified)
  if (opts.version) {
    emailOpts.version_name = opts.version
  }

  return deliver(transport, emailOpts, opts.unsubscribe)
})

const sendEmailWithOptions = emailWithOptionsSender(bulkOptions, TRANSPORT.BULK)
const sendTransactionalEmailWithOptions = emailWithOptionsSender(transactionalOptions, TRANSPORT.TRANSACTIONAL)

// Set to the SendWithUs template id once scripts/i18n/i18n-templates/Group_Closed_i18n
// is uploaded; until then the notice is skipped (the sender resolves false).
const GROUP_CLOSED_TEMPLATE_ID = null

// Set to the SendWithUs template id once scripts/i18n/i18n-templates/Account_Closed_i18n
// is uploaded; until then the confirmation is skipped (the sender resolves false).
const ACCOUNT_CLOSED_TEMPLATE_ID = null

const senders = {
  sendSimpleEmail,

  sendRawEmail: ({ email, data, extraOptions }) =>
    sendSimpleEmail(email, 'tem_jFYJ3bxMyfbbtbwgDGS4JGfK', data, extraOptions),

  sendPasswordReset: opts =>
    sendTransactionalSimpleEmail(opts.email, 'tem_phRPHm3y6RHvRFww6Vc3VBVB', opts.templateData, {}, normalizeLocaleToFull(opts.locale)),

  sendEmailVerification: opts =>
    sendTransactionalSimpleEmail(opts.email, 'tem_h99yGHv9MXTpMrPSDVTjQFyB', opts.templateData, {}, normalizeLocaleToFull(opts.locale)),

  sendFinishRegistration: opts =>
    sendTransactionalSimpleEmail(opts.email, 'tem_fqGSrDrSK6WpjTBFXSfY79k4', opts.templateData, {}, normalizeLocaleToFull(opts.locale)),

  sendModerationAction: ({ email, templateData, locale }) =>
    sendSimpleEmail(email, 'tem_BXYk4Hxt74R9jH3pkdGfqbJM', templateData, {}, normalizeLocaleToFull(locale)),

  sendInvitation: (email, data) =>
    sendEmailWithOptions('tem_GTwXKBfkTpTHRfHpmJWbYr9d', {
      email,
      data,
      locale: normalizeLocaleToFull(data.locale) || 'en-US',
      sender: {
        name: senderNameViaHylo(data.inviter_name, data.locale),
        reply_to: data.inviter_email
      }
    }),

  // TODO: not used, remove this
  sendTagInvitation: (email, data) =>
    sendEmailWithOptions('tem_dwY7bkbHhxrb4vdc8mhjTBgQ', {
      email,
      data,
      locale: normalizeLocaleToFull(data.locale) || 'en-US',
      sender: {
        name: senderNameViaHylo(data.inviter_name, data.locale),
        reply_to: data.inviter_email
      }
    }),

  sendPostNotification: sendEmailWithOptions('tem_cPYpXw7d9pCdm6M8QmtPvPGG'),
  sendPostMentionNotification: sendEmailWithOptions('tem_77d99tkvmTBJt7rD83DD4XRP'),
  sendJoinRequestNotification: sendEmailWithOptions('tem_Dkvtfv9HGgYgjqD4KCXPPdy6'),
  sendApprovedJoinRequestNotification: sendEmailWithOptions('tem_JjPbSJqj4wbJqSydqw49VrfT'),
  sendMemberJoinedGroupNotification: sendEmailWithOptions('tem_rvbqYrfMK8VQkqCPJXBRd6KR'),
  sendDonationToEmail: sendEmailWithOptions('tem_MyJccrgp83dCcb9jtP6pRfG3'),
  sendDonationFromEmail: sendEmailWithOptions('tem_vc664DPVTSTY6JSmpcjt8xTb'),
  sendEventInvitationEmail: sendEmailWithOptions('tem_8pt9FjFkxRGQ7XYhRRW3BBrK'),
  sendEventRsvpEmail: sendEmailWithOptions('tem_93YXdBV6bg4WmD8w3krpGP7H'),
  sendEventRsvpUpdateEmail: sendEmailWithOptions('tem_77XY6QJTVYKKFhDtkVgW3W93'),
  sendEventRsvpCancelEmail: sendEmailWithOptions('tem_YCTQy4pJywkRDw6pfhShDg9H'),
  sendGroupChildGroupInviteNotification: sendEmailWithOptions('tem_7tcVCp6WrxFSRRt9qxfmMm9K'),
  sendGroupChildGroupInviteAcceptedNotification: sendEmailWithOptions('tem_VYrh6YFTB3X6yq66Rm6qMtgD'),
  sendGroupParentGroupJoinRequestNotification: sendEmailWithOptions('tem_PVd9yJtHHBVK4jhm3fpdVBMV'),
  sendGroupParentGroupJoinRequestAcceptedNotification: sendEmailWithOptions('tem_mm6hdXBxRc9dckCp6C386rGG'),
  sendGroupPeerGroupInviteNotification: sendEmailWithOptions('tem_8SjfcXpkCgdCVxrBXd9KD8YY'),
  sendGroupPeerGroupInviteAcceptedNotification: sendEmailWithOptions('tem_W7Vm9KqfKHBvTDJvJYDkHHK4'),
  sendExportMembersList: sendEmailWithOptions('tem_qRkBwBC4MVwqww87gDgRdHSG'),
  sendExportUserAccount: sendEmailWithOptions('tem_qRkBwBC4MVwqww87gDgRdHSG'),
  sendTrackCompletedEmail: sendEmailWithOptions('tem_G69qyjJ6xVHxMJMqcwp98dfF'),
  sendTrackEnrollmentEmail: sendEmailWithOptions('tem_tFrcKvJvTRVYMbDYSrTHwVfV'),
  sendWelcomeEmail: sendEmailWithOptions('tem_jkdjbcSVK9cmGvwXbtX9PQbJ'),
  sendGroupCreatedEmail: sendEmailWithOptions('tem_7dHq84ct6mJS847pTVJK6b4P'),
  sendFundingRoundNewSubmissionEmail: sendEmailWithOptions('tem_dMt4Dwm493JvYdXGWBpTxxR7'),
  sendFundingRoundPhaseTransitionEmail: sendEmailWithOptions('tem_RpRYTwYhTpRmy3Y6tcrCGMwB'),
  sendFundingRoundReminderEmail: sendEmailWithOptions('tem_RpRYTwYhTpRmy3Y6tcrCGMwB'),

  /**
   * Sends a plain-text alert to the Hylo stewards email (NEW_GROUP_EMAIL) about a Stripe
   * dispute or refund threshold being exceeded for a connected group.
   *
   * Uses the generic raw-email template so we control the full subject + body.
   *
   * @param {object} opts
   * @param {string} opts.groupName
   * @param {string} opts.groupSlug
   * @param {string} opts.groupUrl
   * @param {string} opts.stripeAccountId - External Stripe account ID (acct_...)
   * @param {string} opts.stripeDashboardUrl
   * @param {string} opts.alertType - One of: dispute_rate_warning, dispute_rate_critical, dispute_spike
   * @param {string} opts.thresholdTriggered - Human-readable threshold label
   * @param {number} opts.disputeCount90d
   * @param {number} opts.disputeCount7d
   * @param {number} opts.refundCount90d
   * @param {number} opts.totalCharges90d
   * @param {number|null} opts.disputeRate90d - Rate as decimal e.g. 0.0082 for 0.82%
   */
  sendStripeAlertEmail: function (opts) {
    const recipient = process.env.NEW_GROUP_EMAIL
    if (!recipient) return Promise.resolve(false)

    const rateDisplay = opts.disputeRate90d != null
      ? `${(opts.disputeRate90d * 100).toFixed(2)}%`
      : 'N/A'

    const subject = `[Hylo Alert] Stripe ${opts.thresholdTriggered} — Group: ${opts.groupName}`

    const body = `A Stripe alert threshold has been triggered for a group on Hylo. Details below.

WHY THIS MATTERS
----------------
Stripe monitors dispute rates for connected accounts and can suspend or terminate accounts that
exceed their thresholds (warning at 0.75%, critical at 1.0%). A sudden spike in disputes or
refunds may also indicate that a group is misusing the platform — for example by selling
access to content that doesn't match expectations, misleading members, or operating in a way
that's generating buyer complaints.

THRESHOLD TRIGGERED
-------------------
${opts.thresholdTriggered}

GROUP DETAILS
-------------
Name:              ${opts.groupName}
Slug:              ${opts.groupSlug}
URL:               ${opts.groupUrl}
Stripe Account ID: ${opts.stripeAccountId}
Stripe Dashboard:  ${opts.stripeDashboardUrl}

STATS (last 90 days unless noted)
----------------------------------
Total charges:      ${opts.totalCharges90d ?? 'N/A'}
Disputes (90d):     ${opts.disputeCount90d ?? 'N/A'}
Dispute rate (90d): ${rateDisplay}
Disputes (7d):      ${opts.disputeCount7d ?? 'N/A'}
Refunds (90d):      ${opts.refundCount90d ?? 'N/A'}

RECOMMENDED NEXT STEPS
-----------------------
1. Review the group's Stripe dashboard (link above) for dispute details and evidence requirements.
2. Check the group's offerings and recent activity on Hylo for any policy violations.
3. If disputes appear fraudulent or the rate is very high, pause the group's sales in
   Hylo Management > Paid Content > Disputes & Refunds until you've spoken with stewards.
4. Reach out to the group stewards directly to understand what's happening.

This alert will not repeat for this group for 24 hours.`

    return sendSimpleEmail(recipient, 'tem_jFYJ3bxMyfbbtbwgDGS4JGfK', { subject, body }, {
      sender: {
        name: 'Hylo Platform Alerts',
        address: 'dev+bot@hylo.com'
      }
    })
  },

  /**
   * Notifies platform payments staff when a group creates a new Stripe Connect account.
   * Requires PAYMENTS_NOTIFICATION_EMAIL; no email is sent if unset.
   *
   * @param {object} opts
   * @param {string} opts.groupName
   * @param {string} opts.groupSlug
   * @param {string} opts.groupUrl - Absolute URL to the group on Hylo
   * @param {string} opts.groupId - Group database id
   * @param {string} opts.stripeAccountExternalId - Stripe acct_... id
   * @param {string} opts.actorName - Name of the admin who created the connection
   * @param {string} opts.actorEmail
   * @param {string} opts.actorProfileUrl - Absolute URL to the member profile
   */
  sendNewStripeConnectedAccountAdminNotification: function (opts) {
    const recipient = process.env.PAYMENTS_NOTIFICATION_EMAIL
    if (!recipient) return Promise.resolve(false)

    const subject = `New Stripe Account: ${opts.groupName}`

    const body = `A group created a new Stripe Connect account on Hylo.

GROUP
-----
Name:                        ${opts.groupName}
Slug:                        ${opts.groupSlug}
Hylo group ID:               ${opts.groupId}
Group URL:                   ${opts.groupUrl}
Stripe connected account ID: ${opts.stripeAccountExternalId}

INITIATED BY
------------
Name:    ${opts.actorName}
Email:   ${opts.actorEmail}
Profile: ${opts.actorProfileUrl}
`

    return sendSimpleEmail(recipient, 'tem_jFYJ3bxMyfbbtbwgDGS4JGfK', { subject, body }, {
      sender: {
        name: 'Hylo Platform Alerts',
        address: 'dev+bot@hylo.com'
      }
    })
  },

  // Paid content email templates. Receipts, and the payment-failed and renewal-reminder
  // emails about the member's own money, are transactional (D84); a later trial-ending
  // reminder follows the renewal reminder. Cancellation, access granted and access
  // expired notices stay bulk, as does a steward's new-subscriber notice (D62).
  sendPurchaseConfirmation: sendTransactionalEmailWithOptions('tem_9gQQRW8XgygjQpGGxQKYGdMS'),
  sendAccessGranted: sendEmailWithOptions('tem_jfBqFPmhPP9jjfgSPB87YpDV'),
  sendSubscriptionRenewalReminder: sendTransactionalEmailWithOptions('tem_DrD9kmkKTkTCxTM7PhpW4jKf'),
  sendSubscriptionRenewed: sendTransactionalEmailWithOptions('tem_gvBCMVVxrCbt8S9cK98kYP9Q'),
  sendPaymentFailed: sendTransactionalEmailWithOptions('tem_YCXQrSjjqj8VqJWjhqHw66mF'),
  sendRefundProcessed: sendTransactionalEmailWithOptions('tem_qKY6tQFyBcyBXry9wm8yvbxJ'),
  sendSubscriptionCancelled: sendEmailWithOptions('tem_XfXjrYGdvDrPK4Sjprq7FtbS'),
  sendSubscriptionCancelledAdminNotification: sendEmailWithOptions('tem_9ySxcvxKGKBXFQHJm4vS8cDC'),
  sendAccessExpired: sendEmailWithOptions('tem_HVKwWYTMDbhWvvd3TGxtMkMG'),
  sendTrackAccessPurchased: sendTransactionalEmailWithOptions('tem_T63TXtFjmyqhyrw8yfp6YwH8'),

  // Tells a member that a group they were in has been closed (deleted) by its steward
  sendGroupClosed: opts => GROUP_CLOSED_TEMPLATE_ID
    ? sendEmailWithOptions(GROUP_CLOSED_TEMPLATE_ID, opts)
    : Promise.resolve(false),

  // Confirms a deactivated or deleted account (data.variant: 'deactivated' or 'deleted').
  // An account email: sent without the bulk header. Takes { email, locale, data }.
  sendAccountClosed: opts => ACCOUNT_CLOSED_TEMPLATE_ID
    ? sendTransactionalEmailWithOptions(ACCOUNT_CLOSED_TEMPLATE_ID, opts)
    : Promise.resolve(false),

  sendMessageDigest: opts =>
    sendEmailWithOptions('tem_y8HpjwxFSxC9jRqwfVpPxY8d', opts),

  sendCommentDigest: opts =>
    sendEmailWithOptions('tem_Kyq6CbvMmbdjcf7KvpJJFpmX', opts),

  sendChatDigest: opts =>
    sendEmailWithOptions('tem_XjjSPdy6ykMpwq4JGpchmFk6', opts),

  postReplyAddress: function (postId, userId) {
    const plaintext = format('%s%s|%s', process.env.INBOUND_EMAIL_SALT, postId, userId)
    return format('reply-%s@%s', PlayCrypto.encrypt(plaintext), process.env.INBOUND_EMAIL_DOMAIN)
  },

  decodePostReplyAddress: function (address) {
    const salt = new RegExp(format('^%s', process.env.INBOUND_EMAIL_SALT))
    const match = address.match(/reply-(.*?)@/)
    const plaintext = PlayCrypto.decrypt(match[1]).replace(salt, '')
    const ids = plaintext.split('|')
    return { postId: ids[0], userId: ids[1] }
  },

  postCreationAddress: function (groupId, userId, type) {
    const plaintext = format('%s%s|%s|', process.env.INBOUND_EMAIL_SALT, groupId, userId, type)
    return format('create-%s@%s', PlayCrypto.encrypt(plaintext), process.env.INBOUND_EMAIL_DOMAIN)
  },

  decodePostCreationAddress: function (address) {
    const salt = new RegExp(format('^%s', process.env.INBOUND_EMAIL_SALT))
    const match = address.match(/create-(.*?)@/)
    const plaintext = PlayCrypto.decrypt(match[1]).replace(salt, '')
    const decodedData = plaintext.split('|')

    return { groupId: decodedData[0], userId: decodedData[1], type: decodedData[2] }
  },

  formToken: function (groupId, userId) {
    const plaintext = format('%s%s|%s|', process.env.INBOUND_EMAIL_SALT, groupId, userId)
    return PlayCrypto.encrypt(plaintext)
  },

  decodeFormToken: function (token) {
    const salt = new RegExp(format('^%s', process.env.INBOUND_EMAIL_SALT))
    const plaintext = PlayCrypto.decrypt(token).replace(salt, '')
    const decodedData = plaintext.split('|')

    return { groupId: decodedData[0], userId: decodedData[1] }
  },

  // One reminder to someone who started signing up and stopped (api/models/invitation/stalledSignupReminder.js).
  // The template is named by STALLED_SIGNUP_REMINDER_TEMPLATE_ID.
  sendStalledSignupReminder: ({ email, data, locale }) =>
    sendSimpleEmail(email, process.env.STALLED_SIGNUP_REMINDER_TEMPLATE_ID, data, {}, normalizeLocaleToFull(locale))

}

// Each exported send* runs with its own name in currentSender, so deliver() can look up
// whether it is essential or bulk and what its one-click switches off
for (const [name, fn] of Object.entries(senders)) {
  if (typeof fn === 'function' && /^send[A-Z]/.test(name)) {
    senders[name] = (...args) => currentSender.run(name, () => fn(...args))
  }
}

senders.SKIPPED = SKIPPED

module.exports = senders
