import { GraphQLError } from 'graphql'
import validator from 'validator'
import { TextHelpers } from '@hylo/shared'
import { get, isEmpty, map, merge } from 'lodash/fp'

/**
 * Sends an in-app notification to an existing Hylo user invited by user id.
 */
function notifyExistingUser ({ actorId, invitee, group }) {
  const parentId = group.get('parent_id')
  return Activity.saveForReasons([{
    actor_id: actorId,
    reader_id: invitee.id,
    group_id: group.id,
    ...(parentId ? { other_group_id: parentId } : {}),
    reason: Activity.Reason.GroupInvitation
  }])
}

module.exports = {
  checkPermission: (userId, invitationId) => {
    return Invitation.find(invitationId, { withRelated: 'group' })
      .then(async (invitation) => {
        if (!invitation) throw new GraphQLError('Invitation not found')
        const { group } = invitation.relations
        const user = await User.find(userId)
        return user.get('email') === invitation.get('email') || (GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADD_MEMBERS))
      })
  },

  findById: (invitationId) => {
    return Invitation.find(invitationId)
  },

  find: ({ groupId, limit, offset, pendingOnly = false, includeExpired = false }) => {
    return Group.find(groupId)
      .then(group => Invitation.query(qb => {
        qb.limit(limit || 20)
        qb.offset(offset || 0)
        qb.where('group_id', group.get('id'))
        qb.leftJoin('users', 'users.id', 'group_invites.used_by_id')
        qb.select(bookshelf.knex.raw(`
          group_invites.*,
          count(*) over () as total,
          users.id as joined_user_id,
          users.name as joined_user_name,
          users.avatar_url as joined_user_avatar_url,
          (select name from users where lower(users.email) = lower(group_invites.email) limit 1) as invitee_name,
          (select id from users where lower(users.email) = lower(group_invites.email) limit 1) as invitee_id
        `))

        pendingOnly && qb.whereNull('used_by_id')

        !includeExpired && qb.whereNull('expired_by_id')

        qb.orderBy('created_at', 'desc')
      }).fetchAll({ withRelated: ['user'] }))
      .then(invitations => ({
        total: invitations.length > 0 ? Number(invitations.first().get('total')) : 0,
        items: invitations.map(i => {
          let user = i.relations.user
          if (isEmpty(user) && i.get('joined_user_id')) {
            user = {
              id: i.get('joined_user_id'),
              name: i.get('joined_user_name'),
              avatar_url: i.get('joined_user_avatar_url')
            }
          }
          return merge(i.pick('id', 'email', 'created_at', 'last_sent_at'), {
            user: !isEmpty(user) ? user.pick('id', 'name', 'avatar_url') : null,
            name: i.get('invitee_name') || null,
            userId: i.get('invitee_id') || null
          })
        })
      }))
  },

  /**
   *
   * @param sessionUserId
   * @param groupId
   * @param tagName {String}
   * @param userIds {String[]} list of userIds
   * @param emails {String[]} list of emails
   * @param message
   * @param assignCoordinator {Boolean} invite as Coordinator (defaults: false)
   * @param subject
   * @param groupRoleId {Number} group role ID to assign when invitation is used
   */
  create: ({ sessionUserId, groupId, tagName, userIds, emails = [], message, assignCoordinator = false, subject, groupRoleId }) => {
    return Promise.join(
      userIds && User.query(q => q.whereIn('id', userIds)).fetchAll(),
      Group.find(groupId),
      tagName && Tag.find({ name: tagName }),
      (users, group, tag) => {
        const invitedUsers = get('models', users) || []
        const usersByEmail = {}
        invitedUsers.forEach(u => {
          usersByEmail[u.get('email').toLowerCase()] = u
        })
        const concatenatedEmails = emails.concat(map(u => u.get('email'), invitedUsers))

        return Promise.map(concatenatedEmails, email => {
          if (!validator.isEmail(email)) {
            return { email, error: 'not a valid email address' }
          }

          const opts = {
            email,
            userId: sessionUserId,
            groupId: group.id,
            groupRoleId: groupRoleId || null
          }

          if (tag) {
            opts.tagId = tag.id
          } else {
            opts.message = TextHelpers.markdown(message, { disableAutolinking: true })
            // TODO: are we still using this, alongside the groupRoleId?
            opts.assignCoordinator = assignCoordinator
            opts.subject = subject
          }

          return Invitation.create(opts)
            .then(invitation => invitation.refresh({ withRelated: ['creator', 'group', 'tag'] }).then(() => invitation))
            .then(invitation => {
              return Queue.classMethod('Invitation', 'createAndSend', { invitation })
                .then(async () => {
                  const invitee = usersByEmail[email.toLowerCase()]
                  if (invitee && String(invitee.id) !== String(sessionUserId)) {
                    try {
                      await notifyExistingUser({ actorId: sessionUserId, invitee, group })
                    } catch (err) {
                      console.error('Error creating invitation notification', err)
                    }
                  }
                  return {
                    email,
                    id: invitation.id,
                    createdAt: invitation.created_at,
                    lastSentAt: invitation.last_sent_at
                  }
                })
                .catch(err => ({ email, error: err.message }))
            })
        })
      })
  },

  /**
   *
   * @param sessionUserId logged in users ID
   * @param groupId
   * @param subject {String} the email subject
   * @param message {String} the email message text
   * @param assignCoordinator {Boolean} invite as Coordinator
   * @returns {*}
   */
  reinviteAll: ({ sessionUserId, groupId, subject = '', message = '', assignCoordinator = false }) => {
    return Queue.classMethod('Invitation', 'reinviteAll', {
      groupId,
      subject,
      message,
      assignCoordinator,
      userId: sessionUserId
    })
  },

  expire: (userId, invitationId) => {
    return Invitation.find(invitationId)
    .then(invitation => {
      if (!invitation) throw new GraphQLError('not found')

      return invitation.expire(userId)
    })
  },

  resend: (invitationId) => {
    return Invitation.find(invitationId)
    .then(invitation => {
      if (!invitation) throw new GraphQLError('not found')

      return invitation.send()
    })
  },

  /**
   * Check if an invitation is valid and return group information for redirect
   * @param token {String} invitation token from email invite
   * @param accessCode {String} access code from invite link
   * @returns {Object} { valid, groupId, groupSlug, email, groupRole }
   */
  check: async (token, accessCode) => {
    if (accessCode) {
      // Invalid / unknown codes must return { valid: false } — plain .fetch() rejects when no row (Bookshelf).
      const group = await Group.queryByAccessCode(accessCode).fetch({ require: false })
      return {
        valid: !!group,
        groupId: group ? group.get('id') : null,
        groupSlug: group ? group.get('slug') : null
      }
    }
    if (token) {
      const invitation = await Invitation.where({
        token,
        used_by_id: null,
        expired_by_id: null
      }).fetch()
      if (invitation) {
        const group = await Group.find(invitation.get('group_id'))

        // Load the group role if one is assigned to this invitation
        let groupRole = null
        if (invitation.get('group_role_id')) {
          groupRole = await GroupRole.where({ id: invitation.get('group_role_id') }).fetch()
        }

        return {
          valid: true,
          groupId: invitation.get('group_id'),
          groupSlug: group
            ? group.get('slug')
            : null,
          email: invitation.get('email'),
          groupRole: groupRole
            ? {
                id: groupRole.id,
                name: groupRole.get('name'),
                emoji: groupRole.get('emoji')
              }
            : null
        }
      }
      return { valid: false }
    }
    return { valid: false }
  },

  async use (userId, token, accessCode) {
    const user = await User.find(userId)
    if (accessCode) {
      const group = await Group.queryByAccessCode(accessCode).fetch()
      if (!group) throw new Error('Invalid access code')

      // TODO STRIPE: We need to think through how invite links will be impacted by paywall
      const existingMembership = await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
      if (existingMembership?.get('active')) {
        return existingMembership
      }
      const memberships = await group.addMembers([userId], {})
      return memberships[0]
    }

    if (token) {
      return Invitation.where({ token }).fetch()
      .then(invitation => {
        if (!invitation) throw new GraphQLError('not found')
        if (invitation.isExpired()) throw new GraphQLError('expired')
        // TODO STRIPE: We need to think through how invite links will be impacted by paywall
        return invitation.use(userId)
      })
    }

    throw new Error('must provide either token or accessCode')
  }
}
