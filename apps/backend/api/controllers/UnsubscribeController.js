/* global Group, User, sails */
// One-click unsubscribe from a bulk email (D34, RFC 8058).
//
//   GET  /noo/email/unsubscribe?token=           redirects to the confirmation page; it
//                                                never changes anything, so link scanners
//                                                that follow it unsubscribe no one
//   GET  /noo/email/unsubscribe/describe?token=  what the link would switch off (for that page)
//   POST /noo/email/unsubscribe?token=           unsubscribes: the mailbox provider's
//                                                one-click (List-Unsubscribe-Post), or the
//                                                confirmation page's button
//
// The token (lib/email/unsubscribeToken.js) names the recipient and what to switch off
// (lib/email/applyUnsubscribe.js). Answers never include the address.
import applyUnsubscribe, { isAlreadyUnsubscribed } from '../../lib/email/applyUnsubscribe'
import { confirmPageUrl, readUnsubscribeToken } from '../../lib/email/unsubscribeToken'

const tokenFrom = req => {
  const token = req.param('token')
  return typeof token === 'string' ? token : null
}

async function recipientFor (claims) {
  if (!claims) return null
  return User.where({ id: claims.userId }).fetch()
}

const noStore = res => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
}

async function groupNameFor (groupId) {
  if (!groupId) return null
  const group = await Group.where({ id: groupId }).fetch({ columns: ['id', 'name', 'type', 'parent_id'] })
  if (!group) return null
  if (group.get('type') === 'space' && group.get('parent_id')) {
    const parent = await Group.where({ id: group.get('parent_id') }).fetch({ columns: ['id', 'name'] })
    if (parent) return parent.get('name')
  }
  return group.get('name')
}

module.exports = {
  show: function (req, res) {
    noStore(res)
    return res.redirect(confirmPageUrl(tokenFrom(req) || ''))
  },

  describe: async function (req, res) {
    noStore(res)
    try {
      const claims = readUnsubscribeToken(tokenFrom(req))
      const user = await recipientFor(claims)
      if (!user) return res.status(400).json({ error: 'invalid-token' })

      return res.ok({
        descriptor: claims.descriptor,
        groupName: await groupNameFor(claims.groupId),
        frequency: claims.frequency,
        done: await isAlreadyUnsubscribed(user, claims)
      })
    } catch (err) {
      sails.log.error('UnsubscribeController.describe failed', err)
      return res.status(500).json({ error: 'failed' })
    }
  },

  unsubscribe: async function (req, res) {
    noStore(res)
    try {
      const claims = readUnsubscribeToken(tokenFrom(req))
      const user = await recipientFor(claims)
      if (!user) return res.status(400).json({ error: 'invalid-token' })

      const result = await applyUnsubscribe(user, claims)
      return res.ok({ success: true, descriptor: claims.descriptor, applied: result.applied })
    } catch (err) {
      sails.log.error('UnsubscribeController.unsubscribe failed', err)
      return res.status(500).json({ error: 'failed' })
    }
  }
}
