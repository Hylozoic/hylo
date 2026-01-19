import { GraphQLError } from 'graphql'
import validator from 'validator'
import { TextHelpers } from '@hylo/shared'
import { get, isEmpty, map, merge } from 'lodash/fp'

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
        users.avatar_url as joined_user_avatar_url
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
          user: !isEmpty(user) ? user.pick('id', 'name', 'avatar_url') : null
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
   * @param isModerator {Boolean} should invite as moderator (defaults: false)
   * @param subject
   * @param commonRoleId {Number} common role ID to assign when invitation is used
   * @param groupRoleId {Number} group-specific role ID to assign when invitation is used
   */
  create: ({ sessionUserId, groupId, tagName, userIds, emails = [], message, isModerator = false, subject, commonRoleId, groupRoleId }) => {
    return Promise.join(
      userIds && User.query(q => q.whereIn('id', userIds)).fetchAll(),
      Group.find(groupId),
      tagName && Tag.find({ name: tagName }),
      (users, group, tag) => {
        const concatenatedEmails = emails.concat(map(u => u.get('email'), get('models', users)))

        return Promise.map(concatenatedEmails, email => {
          if (!validator.isEmail(email)) {
            return { email, error: 'not a valid email address' }
          }

          const opts = {
            email,
            userId: sessionUserId,
            groupId: group.id,
            commonRoleId: commonRoleId || null,
            groupRoleId: groupRoleId || null
          }

          if (tag) {
            opts.tagId = tag.id
          } else {
            opts.message = TextHelpers.markdown(message, { disableAutolinking: true })
            opts.moderator = isModerator
            opts.subject = subject
          }

          return Invitation.create(opts)
            .tap(i => i.refresh({ withRelated: ['creator', 'group', 'tag'] }))
            .then(invitation => {
              return Queue.classMethod('Invitation', 'createAndSend', { invitation })
                .then(() => ({
                  email,
                  id: invitation.id,
                  createdAt: invitation.created_at,
                  lastSentAt: invitation.last_sent_at
                }))
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
   * @param moderator {Boolean} should invite as moderator
   * @returns {*}
   */
  reinviteAll: ({ sessionUserId, groupId, subject = '', message = '', isModerator = false }) => {
    return Queue.classMethod('Invitation', 'reinviteAll', {
      groupId,
      subject,
      message,
      moderator: isModerator,
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
   * @returns {Object} { valid, groupSlug, email, commonRole, groupRole }
   */
  check: async (token, accessCode) => {
    if (accessCode) {
      const group = await Group.queryByAccessCode(accessCode).fetch()
      return {
        valid: !!group,
        groupSlug: group ? group.get('slug') : null
      }
    }
    if (token) {
      const invitation = await Invitation.query()
        .where({ token, used_by_id: null, expired_by_id: null })
        .first()
      if (invitation) {
        const group = await Group.find(invitation.group_id)

        // Load the common role if one is assigned to this invitation
        let commonRole = null
        if (invitation.common_role_id) {
          commonRole = await CommonRole.where({ id: invitation.common_role_id }).fetch()
        }

        // Load the group-specific role if one is assigned to this invitation
        let groupRole = null
        if (invitation.group_role_id) {
          groupRole = await GroupRole.where({ id: invitation.group_role_id }).fetch()
        }

        return {
          valid: true,
          groupSlug: group
            ? group.get('slug')
            : null,
          email: invitation.email,
          commonRole: commonRole
            ? {
                id: commonRole.id,
                name: commonRole.get('name'),
                emoji: commonRole.get('emoji')
              }
            : null,
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
      return Group.queryByAccessCode(accessCode)
        .fetch()
        .then(group => {
          // TODO STRIPE: We need to think through how invite links will be impacted by paywall
          return GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
            .then(existingMembership => {
              if (existingMembership) {
                return existingMembership.get('active')
                  ? existingMembership
                  : existingMembership.save({ active: true }, { patch: true }).then(membership => {
                    // TODO: just use group.addMembers?
                    group.save({ num_members: group.get('num_members') + 1 }, { patch: true })
                    Queue.classMethod('Group', 'afterAddMembers', {
                      groupId: group.id,
                      newUserIds: [userId],
                      reactivatedUserIds: [userId]
                    })
                    return membership
                  })
              }
              if (group) return user.joinGroup(group, { role: GroupMembership.Role.DEFAULT, fromInvitation: true }).then(membership => membership)
            })
            .catch(err => {
              throw new Error(err.message)
            })
        })
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
