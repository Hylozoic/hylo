import { curry, merge } from 'lodash'
import { format } from 'util'
import { mapLocaleToSendWithUS } from '../../lib/util'

const api = require('sendwithus')(process.env.SENDWITHUS_KEY)
const Promise = require('bluebird')

const sendEmail = opts =>
  new Promise((resolve, reject) =>
    api.send(opts, (err, resp) => err ? reject(err) : resolve(resp)))

const defaultOptions = {
  sender: {
    address: process.env.EMAIL_SENDER,
    name: 'Hylo'
  },
  locale: 'en-US'
}

const sendSimpleEmail = function (address, templateId, data, extraOptions, locale = 'en-US') {
  return sendEmail(merge({}, defaultOptions, {
    email_id: templateId,
    recipient: { address },
    email_data: data,
    locale: mapLocaleToSendWithUS(locale)
  }, extraOptions))
}

const sendEmailWithOptions = curry((templateId, opts) =>
  sendEmail(merge({}, defaultOptions, {
    email_id: templateId,
    recipient: { address: opts.email },
    email_data: opts.data,
    version_name: opts.version,
    locale: mapLocaleToSendWithUS(opts.locale),
    sender: opts.sender, // expects {name, reply_to}
    files: opts.files
  })))

module.exports = {
  sendSimpleEmail,

  sendRawEmail: ({ email, data, extraOptions }) =>
    sendSimpleEmail(email, 'tem_nt4RmzAfN4KyPZYxFJWpFE', data, extraOptions),

  sendPasswordReset: opts =>
    sendSimpleEmail(opts.email, 'tem_mccpcJNEzS4822mAnDNmGT', opts.templateData, mapLocaleToSendWithUS(opts.locale)),

  sendEmailVerification: opts =>
    sendSimpleEmail(opts.email, 'tem_tt6gJkFMgjThCHHR6MwpPPrT', opts.templateData, mapLocaleToSendWithUS(opts.locale)),

  sendFinishRegistration: opts =>
    sendSimpleEmail(opts.email, 'tem_BcfBCCHdDmkvcvkBSGPWYcjJ', opts.templateData, mapLocaleToSendWithUS(opts.locale)),

  sendModerationAction: ({ email, templateData, locale }) =>
    sendSimpleEmail(email, 'tem_Bpb3WGd8dbFHXyKcfV4TTmGB', templateData, mapLocaleToSendWithUS(locale)),

  sendInvitation: (email, data) =>
    sendEmailWithOptions('tem_ZXZuvouDYKKhCrdEWYbEp9', {
      email,
      data,
      locale: mapLocaleToSendWithUS(data.locale) || 'en-US',
      version: 'Redesign 2025',
      sender: {
        name: `${data.inviter_name} (via Hylo)`,
        reply_to: data.inviter_email
      }
    }),

  // TODO: not used, remove this
  sendTagInvitation: (email, data) =>
    sendEmailWithOptions('tem_tmEEpPvtQ69wGkmf9njCx8', {
      email,
      data,
      locale: mapLocaleToSendWithUS(data.locale) || 'en-US',
      version: 'default',
      sender: {
        name: `${data.inviter_name} (via Hylo)`,
        reply_to: data.inviter_email
      }
    }),

  sendPostNotification: sendEmailWithOptions('tem_xMGgjc4cfHCYDr8gWRKwhdXF'),
  sendPostMentionNotification: sendEmailWithOptions('tem_wXiqtyNzAr8EF4fqBna5WQ'),
  sendJoinRequestNotification: sendEmailWithOptions('tem_9sW4aBxaLi5ve57bp7FGXZ'),
  sendApprovedJoinRequestNotification: sendEmailWithOptions('tem_eMJADwteU3zPyjmuCAAYVK'),
  sendMemberJoinedGroupNotification: sendEmailWithOptions('tem_94twpVMrvWmF8QxHPBY6bKg3'),
  sendDonationToEmail: sendEmailWithOptions('tem_bhptVWGW6k67tpFtqRDWKTHQ'),
  sendDonationFromEmail: sendEmailWithOptions('tem_TCgS9xJykShS9mJjwj9Kd3v6'),
  sendEventInvitationEmail: sendEmailWithOptions('tem_DxG3FjMdcvYh63rKvh7gDmmY'),
  sendGroupChildGroupInviteNotification: sendEmailWithOptions('tem_vwd7DKxrGrXPX8Wq63VkTvMd'),
  sendGroupChildGroupInviteAcceptedNotification: sendEmailWithOptions('tem_CWcM3KrQVcQkvHbwVmWXwyvR'),
  sendGroupParentGroupJoinRequestNotification: sendEmailWithOptions('tem_PrBkcV4WTwwdKm4MyPK7kVJB'),
  sendGroupParentGroupJoinRequestAcceptedNotification: sendEmailWithOptions('tem_KcSfYRQCh4pgTGF7pcPjStqP'),
  sendExportMembersList: sendEmailWithOptions('tem_GQPPQmq4dPrQWxkWdDKVcKWT'),
  sendWelcomeEmail: sendEmailWithOptions('tem_7TwDyk3dR67C8WrWg3h7ycvd'),

  sendMessageDigest: opts =>
    sendEmailWithOptions('tem_xwQCfpdRT9K6hvrRFqDdhBRK',
      Object.assign({ version: 'Redesign 2025' }, opts)),

  sendCommentDigest: opts =>
    sendEmailWithOptions('tem_tP6JzrYzvvDXhgTNmtkxuW',
      Object.assign({ version: 'Redesign 2025' }, opts)),

  sendChatDigest: opts =>
    sendEmailWithOptions('tem_rpHJjcbDQQmCFQvGqYFx3g73',
      Object.assign({ version: 'Redesign 2025' }, opts)),

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
