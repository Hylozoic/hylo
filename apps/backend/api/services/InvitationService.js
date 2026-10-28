import { GraphQLError } from 'graphql'
import validator from 'validator'
import { TextHelpers } from '@hylo/shared'
import { get, isEmpty, map, merge } from 'lodash/fp'

/**
 * Builds the public checkInvitation payload for a group, including parent
 * group fields when the invite is for a space.
 */
async function invitationResultForGroup (group, extras = {}) {
  if (!group) return { valid: false }
  const isSpace = group.get('type') === 'space' || !!group.get('parent_id')
  let parentGroupId = null
  let parentGroupSlug = null
  let parentGroupName = null
  if (isSpace && group.get('parent_id')) {
    const parent = await Group.find(group.get('parent_id'))
    if (parent) {
      parentGroupId = parent.id
      parentGroupSlug = parent.get('slug')
      parentGroupName = parent.get('name')
    }
  }
  return {
    valid: true,
    groupId: group.id,
    groupSlug: group.get('slug'),
    groupName: group.get('name'),
    isSpace,
    parentGroupId,
    parentGroupSlug,
    parentGroupName,
    grantAccess: false,
    groupRoles: [],
    ...extras
  }
}

/**
 * Whether this invitation lets its holder join targetGroup without approval.
 * An invitation admits to its own group and, for a space invitation, to the
 * space's parent group. Callers check that the invitation is still valid.
 */
async function preApproves (invitation, targetGroup) {
  if (!invitation || !targetGroup) return false
  const forTarget = String(invitation.get('group_id')) === String(targetGroup.id)
  if (forTarget) return true
  const invitedGroup = await Group.find(invitation.get('group_id'))
  return !!invitedGroup?.get('parent_id') && String(invitedGroup.get('parent_id')) === String(targetGroup.id)
}

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

/**
 * Hold this send against the daily allowance. Administrators of a group with
 * lift_admin_invite_limits are not limited. Every address counts, including
 * ones that will not receive an email.
 */
async function enforceInviteAllowance (userId, group, count) {
  if (!count) return
  if (count > InvitationSend.LIMITS.perSend) {
    throw new GraphQLError(`You can invite up to ${InvitationSend.LIMITS.perSend} people at a time`)
  }
  const unlimited = group.get('lift_admin_invite_limits') &&
    await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION)
  if (unlimited) return
  await bookshelf.transaction(async transacting => {
    await InvitationSend.lockAllowance({ userId, groupId: group.id }, { transacting })
    const remaining = await InvitationSend.remainingAllowance({ userId, groupId: group.id }, { transacting })
    if (count > remaining) throw new GraphQLError('invite-limit')
    await InvitationSend.record({ userId, groupId: group.id, recipients: count }, { transacting })
  })
}

/**
 * Roles a link assigns on join, as { id, name, emoji }, skipping inactive ones.
 */
async function rolesPayload (link, group) {
  const ids = link.grantedRoleIds()
  if (ids.length === 0 || !GroupInviteLink.grantsAccess(link, group)) return []
  const roleScopeId = await Group.roleScopeId(group.id)
  const roles = await GroupRole.query(q => {
    q.whereIn('id', ids)
    q.where({ group_id: roleScopeId, active: true })
    q.whereIn('type', [GroupRole.TYPE_SYSTEM, GroupRole.TYPE_CUSTOM])
  }).fetchAll()
  return roles.map(role => ({
    id: role.id,
    name: role.get('name'),
    emoji: role.get('emoji')
  }))
}

module.exports = {
  preApproves,

  checkPermission: (userId, invitationId) => {
    return Invitation.find(invitationId, { withRelated: 'group' })
      .then(async (invitation) => {
        if (!invitation) throw new GraphQLError('Invitation not found')
        const { group } = invitation.relations
        const user = await User.find(userId)
        return user.get('email') === invitation.get('email') || (GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADD_MEMBERS))
      })
  },

  /**
   * Whether this person can cancel the invitation: the invitee, anyone with
   * Add Members, and the sender of a member invitation.
   */
  canExpire: async (userId, invitationId) => {
    const invitation = await Invitation.find(invitationId, { withRelated: 'group' })
    if (!invitation) throw new GraphQLError('Invitation not found')
    const user = await User.find(userId)
    if (user && user.get('email') === invitation.get('email')) return true
    return GroupMembership.hasResponsibility(userId, invitation.relations.group, Responsibility.constants.RESP_ADD_MEMBERS)
  },

  findById: (invitationId) => {
    return Invitation.find(invitationId)
  },

  find: ({ groupId, limit, offset, pendingOnly = false, includeExpired = false, invitedById }) => {
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

        invitedById && qb.where('invited_by_id', invitedById)

        qb.orderBy('created_at', 'desc')
      }).fetchAll({ withRelated: ['user'] }))
      .then(invitations => {
        const total = invitations.length > 0 ? Number(invitations.first().get('total')) : 0
        const items = invitations.map(i => {
          let user = i.relations.user
          if (isEmpty(user) && i.get('joined_user_id')) {
            user = {
              id: i.get('joined_user_id'),
              name: i.get('joined_user_name'),
              avatar_url: i.get('joined_user_avatar_url')
            }
          }
          return merge(i.pick('id', 'email', 'created_at', 'last_sent_at'), {
            user: !isEmpty(user) && user.pick ? user.pick('id', 'name', 'avatar_url') : (isEmpty(user) ? null : user),
            name: i.get('invitee_name') || null,
            userId: i.get('invitee_id') || null,
            creator: () => i.creator()
          })
        })
        return {
          total,
          hasMore: (offset || 0) + items.length < total,
          items
        }
      })
  },

  /**
   *
   * @param sessionUserId
   * @param groupId
   * @param tagName {String}
   * @param userIds {String[]} list of userIds
   * @param emails {String[]} list of emails
   * @param message
   * @param assignAdministrator {Boolean} invite as Administrator (defaults: false)
   * @param subject
   * @param groupRoleId {Number} group role ID to assign when invitation is used
   */
  create: ({ sessionUserId, groupId, tagName, userIds, emails = [], message, assignAdministrator = false, subject, groupRoleId }) => {
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
        const validCount = concatenatedEmails.filter(email => validator.isEmail(email)).length

        return enforceInviteAllowance(sessionUserId, group, validCount)
          .then(() => Promise.map(concatenatedEmails, email => {
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
              opts.assignAdministrator = assignAdministrator
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
          }))
      })
  },

  /**
   *
   * @param sessionUserId logged in users ID
   * @param groupId
   * @param subject {String} the email subject
   * @param message {String} the email message text
   * @param assignAdministrator {Boolean} invite as Administrator
   * @returns {*}
   */
  reinviteAll: ({ sessionUserId, groupId, subject = '', message = '', assignAdministrator = false }) => {
    return Queue.classMethod('Invitation', 'reinviteAll', {
      groupId,
      subject,
      message,
      assignAdministrator,
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
   * Check if an invitation is valid and return group information for redirect.
   * An invite link also says whether it grants access to join, and which roles
   * joining through it assigns.
   * @param token {String} invitation token from email invite
   * @param accessCode {String} access code from invite link
   * @returns {Object} { valid, groupId, groupSlug, groupName, isSpace, parentGroupSlug, email, groupRole, grantAccess, groupRoles }
   */
  check: async (token, accessCode) => {
    if (accessCode) {
      const link = await GroupInviteLink.findActiveByCode(accessCode)
      const group = link
        ? await Group.find(link.get('group_id'))
        : await Group.queryByAccessCode(accessCode).fetch({ require: false })
      if (!group || group.get('active') === false) return { valid: false }
      const grantAccess = link ? GroupInviteLink.grantsAccess(link, group) : true
      return invitationResultForGroup(group, {
        grantAccess,
        groupRoles: link ? await rolesPayload(link, group) : []
      })
    }
    if (token) {
      const invitation = await Invitation.where({
        token,
        used_by_id: null,
        expired_by_id: null
      }).fetch()
      if (invitation) {
        const group = await Group.find(invitation.get('group_id'))
        if (!group) return { valid: false }

        // Load the group role if one is assigned to this invitation
        let groupRole = null
        if (invitation.get('group_role_id')) {
          groupRole = await GroupRole.where({ id: invitation.get('group_role_id') }).fetch()
        }

        return invitationResultForGroup(group, {
          groupId: invitation.get('group_id'),
          email: invitation.get('email'),
          grantAccess: true,
          groupRole: groupRole
            ? {
                id: groupRole.id,
                name: groupRole.get('name'),
                emoji: groupRole.get('emoji')
              }
            : null
        })
      }
      return { valid: false }
    }
    return { valid: false }
  },

  /**
   * Join the group with a join link code or an invitation token.
   * A link that does not grant access does not join: the person sees the group
   * and follows its normal Open, Restricted or Closed rules.
   */
  async use (userId, token, accessCode) {
    const user = await User.find(userId)
    if (accessCode) {
      const link = await GroupInviteLink.findActiveByCode(accessCode)
      const group = link
        ? await Group.find(link.get('group_id'))
        : await Group.queryByAccessCode(accessCode).fetch({ require: false })
      if (!group) throw new Error('Invalid access code')
      if (link && !GroupInviteLink.grantsAccess(link, group)) {
        throw new GraphQLError('This link does not grant access to join')
      }

      // TODO STRIPE: We need to think through how invite links will be impacted by paywall
      const existingMembership = await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
      if (existingMembership?.get('active')) {
        return existingMembership
      }
      const memberships = await group.addMembers([userId], {})
      if (link) await GroupInviteLink.recordJoin(link, userId)
      return memberships[0]
    }

    if (token) {
      const invitation = await Invitation.where({ token }).fetch()
      if (!invitation) throw new GraphQLError('not found')
      if (invitation.isExpired()) throw new GraphQLError('expired')
      // TODO STRIPE: We need to think through how invite links will be impacted by paywall
      return invitation.use(userId)
    }

    throw new Error('must provide either token or accessCode')
  }
}
