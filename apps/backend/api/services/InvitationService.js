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
    requiresApproval: false,
    invitedBy: null,
    ...extras
  }
}

/**
 * Whether this invitation lets its holder join targetGroup without approval.
 * An invitation from someone with Add Members admits to its own group and,
 * for a space invitation, to the space's parent group. A member invitation
 * only ever admits directly to its own group when that is an Open top-level
 * group; anywhere else a steward approves the person's request to join.
 * Callers check that the invitation is still valid.
 */
async function preApproves (invitation, targetGroup) {
  if (!invitation || !targetGroup) return false
  const forTarget = String(invitation.get('group_id')) === String(targetGroup.id)
  if (invitation.isLimited()) {
    return forTarget &&
      !targetGroup.get('parent_id') &&
      targetGroup.get('type') !== 'space' &&
      targetGroup.get('accessibility') === Group.Accessibility.OPEN
  }
  if (forTarget) return true
  const invitedGroup = await Group.find(invitation.get('group_id'))
  return !!invitedGroup?.get('parent_id') && String(invitedGroup.get('parent_id')) === String(targetGroup.id)
}

/**
 * Who sent an invitation, as shown to the person invited and to stewards:
 * only their id, name and avatar.
 */
async function invitationSender (invitation) {
  const creator = await invitation.creator().fetch()
  return creator
    ? { id: creator.id, name: creator.get('name'), avatarUrl: creator.get('avatar_url') }
    : null
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
 * Which of these lowercased addresses belong to active members of the group or
 * already have a pending invitation to it.
 */
async function addressesAlreadyInGroup (groupId, emails, transacting) {
  const lowerEmail = column => bookshelf.knex.raw(`lower(${column})`)
  const members = await bookshelf.knex('group_memberships')
    .join('users', 'users.id', 'group_memberships.user_id')
    .where({ 'group_memberships.group_id': groupId, 'group_memberships.active': true })
    .whereIn(lowerEmail('users.email'), emails)
    .select(bookshelf.knex.raw('lower(users.email) as email'))
    .transacting(transacting)
  const invited = await bookshelf.knex('group_invites')
    .where({ group_id: groupId })
    .whereNull('used_by_id')
    .whereNull('expired_by_id')
    .whereIn(lowerEmail('email'), emails)
    .select(bookshelf.knex.raw('lower(email) as email'))
    .transacting(transacting)
  return new Set(members.concat(invited).map(row => row.email))
}

module.exports = {
  preApproves,

  invitationSender,

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
    if (invitation.isLimited() && String(invitation.get('invited_by_id')) === String(userId)) return true
    const user = await User.find(userId)
    if (user && user.get('email') === invitation.get('email')) return true
    return GroupMembership.hasResponsibility(userId, invitation.relations.group, Responsibility.constants.RESP_ADD_MEMBERS)
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
          return merge(i.pick('id', 'email', 'created_at', 'last_sent_at', 'inviter_access'), {
            user: !isEmpty(user) ? user.pick('id', 'name', 'avatar_url') : null,
            name: i.get('invitee_name') || null,
            userId: i.get('invitee_id') || null,
            creator: () => i.creator()
          })
        })
      }))
  },

  /**
   * The pending invitations this person sent with limited access: the address
   * they typed and when it was sent, without looking up who it belongs to.
   */
  findOwnLimited: async ({ groupId, userId, limit, offset }) => {
    const invitations = await Invitation.query(qb => {
      qb.select(bookshelf.knex.raw('group_invites.*, count(*) over () as total'))
      qb.where({ group_id: groupId, invited_by_id: userId, inviter_access: Invitation.InviterAccess.LIMITED })
      qb.whereNull('used_by_id')
      qb.whereNull('expired_by_id')
      qb.orderBy('created_at', 'desc')
      qb.limit(limit || 20)
      qb.offset(offset || 0)
    }).fetchAll()
    return {
      total: invitations.length > 0 ? Number(invitations.first().get('total')) : 0,
      items: invitations.map(i => ({
        ...i.pick('id', 'email', 'created_at', 'last_sent_at'),
        creator: () => i.creator()
      }))
    }
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
        })
      })
  },

  /**
   * Send personal email invitations from someone with limited invite access.
   * Addresses are trimmed, lowercased and deduplicated. Every valid address
   * counts toward the daily allowance and is reported as sent, but nothing is
   * sent to the sender, to active members, or to anyone who already has a
   * pending invitation to the group, and the result does not say which.
   * @returns {Object[]} { email, status: 'sent' } or { email, error: 'invalid' } for each address
   */
  createLimited: async ({ sessionUserId, groupId, emails, subject, message }) => {
    const results = []
    const addresses = []
    for (const entry of emails || []) {
      const typed = String(entry ?? '').trim()
      if (!typed) continue
      const email = typed.toLowerCase()
      if (!validator.isEmail(email)) {
        results.push({ email: typed, error: 'invalid' })
      } else if (!addresses.includes(email)) {
        addresses.push(email)
        results.push({ email, status: 'sent' })
      }
    }
    if (addresses.length > InvitationSend.LIMITS.perSend) {
      throw new GraphQLError(`You can invite up to ${InvitationSend.LIMITS.perSend} email addresses at a time`)
    }
    if (addresses.length === 0) return results

    const inviter = await User.find(sessionUserId)
    const invitations = await bookshelf.transaction(async transacting => {
      await InvitationSend.lockAllowance({ userId: sessionUserId, groupId }, { transacting })
      const remaining = await InvitationSend.remainingAllowance({ userId: sessionUserId, groupId }, { transacting })
      if (addresses.length > remaining) throw new GraphQLError('invite-limit')
      await InvitationSend.record({ userId: sessionUserId, groupId, recipients: addresses.length }, { transacting })

      const skipped = await addressesAlreadyInGroup(groupId, addresses, transacting)
      skipped.add((inviter.get('email') || '').toLowerCase())
      const created = []
      for (const email of addresses.filter(address => !skipped.has(address))) {
        created.push(await Invitation.create({
          email,
          userId: sessionUserId,
          groupId,
          subject,
          message: TextHelpers.markdown(message, { disableAutolinking: true }),
          inviterAccess: Invitation.InviterAccess.LIMITED
        }, { transacting }))
      }
      return created
    })

    await Promise.map(invitations, invitation =>
      Queue.classMethod('Invitation', 'createAndSend', { invitation })
        .catch(err => console.error('Error queueing invitation email', err)))

    return results
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
   * For a member invitation, also who sent it and whether a steward has to
   * approve the person's request to join, which the group's accessibility at
   * the time of the check decides.
   * @param token {String} invitation token from email invite
   * @param accessCode {String} access code from invite link
   * @returns {Object} { valid, groupId, groupSlug, groupName, isSpace, parentGroupSlug, email, groupRole, requiresApproval, invitedBy }
   */
  check: async (token, accessCode) => {
    if (accessCode) {
      // Invalid / unknown codes must return { valid: false } — plain .fetch() rejects when no row (Bookshelf).
      const group = await Group.queryByAccessCode(accessCode).fetch({ require: false })
      if (!group) return { valid: false }
      return invitationResultForGroup(group)
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

        const fromMember = invitation.isLimited()
        return invitationResultForGroup(group, {
          groupId: invitation.get('group_id'),
          email: invitation.get('email'),
          groupRole: groupRole
            ? {
                id: groupRole.id,
                name: groupRole.get('name'),
                emoji: groupRole.get('emoji')
              }
            : null,
          requiresApproval: fromMember && !(await preApproves(invitation, group)),
          invitedBy: fromMember ? await invitationSender(invitation) : null
        })
      }
      return { valid: false }
    }
    return { valid: false }
  },

  /**
   * Join the group with a join link code or an invitation token.
   * @returns the membership or, for a member invitation the person cannot join
   *   with directly, { requiresApproval: true, groupSlug } without joining:
   *   either a steward has to approve new people, and the person can request to
   *   join with the token, or the group has prerequisite groups the person has
   *   not joined yet, which its about page lists.
   */
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
      const invitation = await Invitation.where({ token }).fetch()
      if (!invitation) throw new GraphQLError('not found')
      if (invitation.isExpired()) throw new GraphQLError('expired')
      if (invitation.isLimited()) {
        const group = await invitation.group().fetch()
        const canJoinDirectly = await preApproves(invitation, group) && await group.numPrerequisitesLeft(userId) === 0
        if (!canJoinDirectly && !(await GroupMembership.forPair(userId, group.id).fetch())) {
          return { requiresApproval: true, groupSlug: group.get('slug') }
        }
      }
      // TODO STRIPE: We need to think through how invite links will be impacted by paywall
      return invitation.use(userId)
    }

    throw new Error('must provide either token or accessCode')
  }
}
