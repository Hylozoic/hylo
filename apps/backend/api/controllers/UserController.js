import { filter, includes, isEmpty, mapKeys, merge, omitBy, pick, snakeCase, uniq } from 'lodash'
import { getLocaleStrings } from '../../lib/i18n/locales'
import InvitationService from '../services/InvitationService'
import OIDCAdapter from '../services/oidc/KnexAdapter'
import { decodeHyloJWT } from '../../lib/HyloJWT'
import { joinRoom, leaveRoom } from '../services/Websockets'
import {
  UNSUBSCRIBE_SCOPE,
  UNSUBSCRIBE_SCOPE_SETTING,
  isUnsubscribeScope,
  unsubscribeScopeOf
} from '../models/notification/rules/unsubscribeScope'

// Values each membership-level setting accepts, with what a missing key behaves as
// (no digest is sent and new posts are not notified).
const MEMBERSHIP_SETTING_VALUES = {
  digestFrequency: { values: ['daily', 'weekly', 'never'], missing: 'never' },
  postNotifications: { values: ['none', 'important', 'all'], missing: 'none' }
}

const MIXED = 'mixed'

// unsubscribeScope 'none' removes a saved scope (Resubscribe)
const CLEAR_SCOPE = 'none'

// What the request asks for: one of the four scopes, CLEAR_SCOPE, undefined (no change),
// or false for a value this endpoint doesn't know. An older page's unsubscribeAll
// means 'everything except direct', as past choices do (D35).
function requestedScope ({ unsubscribeScope, unsubscribeAll }) {
  if (unsubscribeScope !== undefined && unsubscribeScope !== null) {
    return isUnsubscribeScope(unsubscribeScope) || unsubscribeScope === CLEAR_SCOPE ? unsubscribeScope : false
  }
  if (unsubscribeAll === true || unsubscribeAll === 'true') return UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT
  return undefined
}

function sharedMembershipSetting (memberships, key, fallback) {
  if (memberships.length === 0) return fallback
  const values = uniq(memberships.map(m => m.getSetting(key) || MEMBERSHIP_SETTING_VALUES[key].missing))
  return values.length === 1 ? values[0] : MIXED
}

module.exports = {

  create: async function (req, res) {
    // Server-to-server only (see APIs.md); checkClientCredentials lets requests without a Bearer token through.
    if (!req.api_client?.super) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { name, email, groupId, isAdministrator, isCoordinator } = req.allParams()
    const group = groupId && await Group.find(groupId)
    const assignAdministrator = [isAdministrator, isCoordinator].some(value => value === true || value === 'true')

    const user = await User.find(email, {}, false)
    if (user) {
      // User already exists
      if (group) {
        const locale = user?.getLocale()
        const L = getLocaleStrings(locale)
        if (!(await GroupMembership.hasActiveMembership(user, group))) {
          // If user exists but is not part of the group then invite them
          let message = L.apiInviteMessageContent(req.api_client)
          let subject = L.apiInviteMessageSubject(group.get('name'))
          if (req.api_client) {
            const client = await (new OIDCAdapter('Client')).find(req.api_client.id)
            if (!client) {
              return res.status(403).json({ error: 'Unauthorized' })
            }
            subject = client.invite_subject || L.clientInviteSubjectDefault(group.get('name'))
            message = client.invite_message || L.clientInviteMessageDefault({ userName: user.get('name'), groupName: group.get('name') })
          }
          const inviteBy = await group.stewards().fetchOne()

          await InvitationService.create({
            groupId: group.id,
            assignAdministrator,
            message,
            sessionUserId: inviteBy?.id,
            subject,
            userIds: [user.id]
          })
          return res.ok({ message: `User already exists, invite sent to group ${group.get('name')}` })
        }
        return res.ok({ message: 'User already exists, and is already a member of this group' })
      }
      return res.ok({ message: 'User already exists' })
    }

    const attrs = { name, email: email ? email.toLowerCase() : null, email_validated: false, active: false, group }
    if (assignAdministrator) {
      attrs.assignAdministrator = true
    }

    return User.create(attrs)
      .then(async (user) => {
        Queue.classMethod('Email', 'sendFinishRegistration', {
          email,
          templateData: {
            api_client: req.api_client?.name,
            group_name: group && group.get('name'),
            group_avatar_url: group && group.get('avatar_url'),
            group_url: Frontend.Route.group(group),
            verify_url: Frontend.Route.verifyEmail(email, user.generateJWT())
          }
        })

        return res.ok({
          id: user.id,
          name: user.get('name'),
          email: user.get('email')
        })
      })
      .catch(function (err) {
        res.status(422).send({ error: err.message ? err.message : err })
      })
  },

  getNotificationSettings: async function (req, res) {
    const { token } = req.allParams()

    let decodedToken
    try {
      decodedToken = decodeHyloJWT(token)
    } catch {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const user = await User.find(decodedToken.sub)
    if (!user || decodedToken.action !== 'notification_settings') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const memberships = await user.memberships().fetch({ withRelated: 'group' })
    const emailable = filter(memberships.models, mem => mem.getSetting('sendEmail'))
    const pushable = filter(memberships.models, mem => mem.getSetting('sendPushNotifications'))
    // Spaces are included in their parent group's digest and have none of their own
    const digestMemberships = filter(memberships.models, mem => mem.related('group').get('type') !== 'space')
    const userSettings = user.get('settings') || {}

    return res.ok({
      digestFrequency: sharedMembershipSetting(digestMemberships, 'digestFrequency', userSettings.digest_frequency || null),
      dmNotifications: userSettings.dm_notifications || 'both',
      commentNotifications: userSettings.comment_notifications || 'both',
      postNotifications: sharedMembershipSetting(memberships.models, 'postNotifications', userSettings.post_notifications || null),
      sendEmail: !isEmpty(emailable),
      sendPushNotifications: !isEmpty(pushable),
      unsubscribeScope: unsubscribeScopeOf(userSettings),
      hasDevice: false // DEPRECATED, remove after 2025-08-15
    })
  },

  // Update a user's notification settings
  // Autheticate them with a JWT token, and then allow them to update their notification settings
  updateNotificationSettings: async function (req, res) {
    const { token } = req.allParams()
    const { allGroupNotifications } = req.body
    const scope = requestedScope(req.body)

    let decodedToken
    try {
      decodedToken = decodeHyloJWT(token)
    } catch {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const user = await User.find(decodedToken.sub)

    if (!user || decodedToken.action !== 'notification_settings') {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    if (scope === false) {
      return res.status(400).json({ error: 'Invalid value for unsubscribeScope' })
    }
    const everything = scope === UNSUBSCRIBE_SCOPE.EVERYTHING

    // 'mixed' is what getNotificationSettings reports when memberships differ; sending it back means unchanged
    const requested = omitBy(
      pick(req.body, ['digestFrequency', 'dmNotifications', 'commentNotifications', 'postNotifications']),
      value => value === undefined || value === null || value === MIXED
    )
    const membershipSettings = pick(requested, Object.keys(MEMBERSHIP_SETTING_VALUES))
    for (const [key, value] of Object.entries(membershipSettings)) {
      if (!includes(MEMBERSHIP_SETTING_VALUES[key].values, value)) {
        return res.status(400).json({ error: `Invalid value for ${key}` })
      }
    }

    // Update the user's notification settings. Only 'everything' switches off direct
    // messages and comments; 'everything except direct' leaves them as they are (D7, D35).
    const userSettings = everything
      ? {
          digest_frequency: 'never',
          dm_notifications: 'none',
          comment_notifications: 'none',
          post_notifications: 'none'
        }
      : mapKeys(requested, (v, k) => snakeCase(k))

    const settings = merge({}, user.get('settings'), userSettings)
    if (scope === CLEAR_SCOPE) {
      delete settings[UNSUBSCRIBE_SCOPE_SETTING]
    } else if (scope) {
      settings[UNSUBSCRIBE_SCOPE_SETTING] = scope
    }
    await user.save({ settings }, { patch: true })

    // Digests and new-post notifications read these from each membership, not from the user
    if (!everything && !isEmpty(membershipSettings)) {
      await bookshelf.knex('group_memberships')
        .where({ user_id: user.id, active: true })
        .update({ settings: bookshelf.knex.raw('settings || ?::jsonb', [JSON.stringify(membershipSettings)]) })
    }

    let newMembershipSettings = false

    // Update the settings for their group memberships. 'No group emails' and 'everything'
    // turn off each group's email; only 'everything' also turns off push.
    const noGroupEmail = everything || scope === UNSUBSCRIBE_SCOPE.NO_GROUP_EMAILS
    if (noGroupEmail || allGroupNotifications === 'none' || allGroupNotifications === 'push') {
      newMembershipSettings = '\'sendEmail\', false'
    } else if (allGroupNotifications === 'email' || allGroupNotifications === 'both') {
      newMembershipSettings = '\'sendEmail\', true'
    }

    if (everything || allGroupNotifications === 'none' || allGroupNotifications === 'email') {
      newMembershipSettings = (newMembershipSettings ? newMembershipSettings + ',' : '') + '\'sendPushNotifications\', false'
    } else if (allGroupNotifications === 'push' || allGroupNotifications === 'both') {
      newMembershipSettings = (newMembershipSettings ? newMembershipSettings + ',' : '') + '\'sendPushNotifications\', true'
    }

    if (newMembershipSettings) {
      await bookshelf.knex.raw('update group_memberships set settings = settings || jsonb_build_object(' + newMembershipSettings + ') where user_id = ' + user.id)
    }

    return res.ok({ message: 'Notification settings updated' })
  },

  subscribeToUpdates: function (req, res) {
    joinRoom(req, res, 'user', req.session.userId)
  },

  unsubscribeFromUpdates: function (req, res) {
    leaveRoom(req, res, 'group', req.session.userId)
  }

}
