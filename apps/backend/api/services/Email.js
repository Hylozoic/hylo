import { curry, merge } from 'lodash'
import { format } from 'util'
import { mapLocaleToSendWithUS } from '../../lib/util'

const api = require('sendwithus')(process.env.SENDWITHUS_KEY)

const sendEmail = async opts => {
  try {
    await api.send(opts)
    return true
  } catch (err) {
    console.error('Error sending email:', err, ' email opts = ', opts)
    return false
  }
}

const defaultOptions = {
  sender: {
    address: process.env.EMAIL_SENDER,
    name: 'The Team at Hylo'
  },
  locale: 'en-US',
  headers: {
    Precedence: 'bulk',
    'X-Auto-Response-Suppress': 'All'
  }
}

const sendSimpleEmail = (address, templateId, data, extraOptions, locale = 'en-US') =>
  sendEmail(merge({}, defaultOptions, {
    email_id: templateId,
    recipient: { address },
    email_data: data,
    locale: mapLocaleToSendWithUS(locale)
  }, extraOptions))

const sendEmailWithOptions = curry((templateId, opts) => {
  const emailOpts = merge({}, defaultOptions, {
    email_id: templateId,
    recipient: { address: opts.email },
    email_data: opts.data,
    locale: mapLocaleToSendWithUS(opts.locale),
    sender: opts.sender, // expects {name, reply_to}
    files: opts.files
  })
  
  // Only include version_name if provided (SendWithUs will use most recent published version if not specified)
  if (opts.version) {
    emailOpts.version_name = opts.version
  }
  
  return sendEmail(emailOpts)
})

module.exports = {
  sendSimpleEmail,

  sendRawEmail: ({ email, data, extraOptions }) =>
    sendSimpleEmail(email, 'tem_jFYJ3bxMyfbbtbwgDGS4JGfK', data, extraOptions),

  sendPasswordReset: opts =>
    sendSimpleEmail(opts.email, 'tem_phRPHm3y6RHvRFww6Vc3VBVB', opts.templateData, {}, mapLocaleToSendWithUS(opts.locale)),

  sendEmailVerification: opts =>
    sendSimpleEmail(opts.email, 'tem_h99yGHv9MXTpMrPSDVTjQFyB', opts.templateData, {}, mapLocaleToSendWithUS(opts.locale)),

  sendFinishRegistration: opts =>
    sendSimpleEmail(opts.email, 'tem_fqGSrDrSK6WpjTBFXSfY79k4', opts.templateData, {}, mapLocaleToSendWithUS(opts.locale)),

  sendModerationAction: ({ email, templateData, locale }) =>
    sendSimpleEmail(email, 'tem_BXYk4Hxt74R9jH3pkdGfqbJM', templateData, {}, mapLocaleToSendWithUS(locale)),

  sendInvitation: (email, data) =>
    sendEmailWithOptions('tem_GTwXKBfkTpTHRfHpmJWbYr9d', {
      email,
      data,
      locale: mapLocaleToSendWithUS(data.locale) || 'en-US',
      sender: {
        name: `${data.inviter_name} (via Hylo)`,
        reply_to: data.inviter_email
      }
    }),

  // TODO: not used, remove this
  sendTagInvitation: (email, data) =>
    sendEmailWithOptions('tem_dwY7bkbHhxrb4vdc8mhjTBgQ', {
      email,
      data,
      locale: mapLocaleToSendWithUS(data.locale) || 'en-US',
      sender: {
        name: `${data.inviter_name} (via Hylo)`,
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
  sendFundingRoundNewSubmissionEmail: sendEmailWithOptions('tem_dMt4Dwm493JvYdXGWBpTxxR7'),
  sendFundingRoundPhaseTransitionEmail: sendEmailWithOptions('tem_RpRYTwYhTpRmy3Y6tcrCGMwB'),
  sendFundingRoundReminderEmail: sendEmailWithOptions('tem_RpRYTwYhTpRmy3Y6tcrCGMwB'),

  // Paid content email templates
  sendPurchaseConfirmation: sendEmailWithOptions('tem_9gQQRW8XgygjQpGGxQKYGdMS'),
  sendAccessGranted: sendEmailWithOptions('tem_jfBqFPmhPP9jjfgSPB87YpDV'),
  sendSubscriptionRenewalReminder: sendEmailWithOptions('tem_DrD9kmkKTkTCxTM7PhpW4jKf'),
  sendSubscriptionRenewed: sendEmailWithOptions('tem_gvBCMVVxrCbt8S9cK98kYP9Q'),
  sendPaymentFailed: sendEmailWithOptions('tem_YCXQrSjjqj8VqJWjhqHw66mF'),
  sendSubscriptionCancelled: sendEmailWithOptions('tem_XfXjrYGdvDrPK4Sjprq7FtbS'),
  sendSubscriptionCancelledAdminNotification: sendEmailWithOptions('tem_9ySxcvxKGKBXFQHJm4vS8cDC'),
  sendAccessExpired: sendEmailWithOptions('tem_HVKwWYTMDbhWvvd3TGxtMkMG'),
  sendDonationAcknowledgment: sendEmailWithOptions('tem_yXtGDQrJPb3Wdd8h4hpRV4yM'),
  sendTrackAccessPurchased: sendEmailWithOptions('tem_T63TXtFjmyqhyrw8yfp6YwH8'),

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
  }

}
