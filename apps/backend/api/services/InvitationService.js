import { GraphQLError } from 'graphql'
import validator from 'validator'
import { TextHelpers } from '@hylo/shared'
import { get, isEmpty, map, merge } from 'lodash/fp'
import { MEMBER_INVITE_PICKER, isFeatureEnabled } from '../../lib/featureFlags'

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

// How long a member's "Your pending invites" list keeps what they submitted, sent
// or not: until after both automatic reminders (4 and 13 days after sending)
const SUBMISSION_LIST_DAYS = 14

/**
 * Record an address someone with limited invite access typed, or a person they
 * picked, whether or not an invitation was created for it, so their list of
 * pending invites shows every one in the same way.
 */
function recordSubmission ({ userId, groupId, email = null, inviteeId = null, invitationId = null }, transacting) {
  return bookshelf.knex('invitation_submissions')
    .insert({ user_id: userId, group_id: groupId, email, invitee_id: inviteeId, invitation_id: invitationId, created_at: new Date() })
    .transacting(transacting)
}

/**
 * Which of these people share an active group with the sender, as a map from
 * their id to their lowercased email address: the only people someone with
 * limited invite access can pick from the people search.
 */
async function peopleSharingAGroup (senderId, userIds) {
  const rows = await bookshelf.knex('users')
    .whereIn('users.id', userIds)
    .where('users.active', true)
    .whereNotNull('users.email')
    .whereExists(function () {
      this.select(bookshelf.knex.raw(1)).from('group_memberships as theirs')
        .join('group_memberships as mine', 'mine.group_id', 'theirs.group_id')
        .join('groups as shared', 'shared.id', 'theirs.group_id')
        .whereRaw('theirs.user_id = users.id')
        .where('theirs.active', true)
        .where('mine.user_id', senderId)
        .where('mine.active', true)
        .where('shared.active', true)
    })
    .select('users.id', bookshelf.knex.raw('lower(users.email) as email'))
  return new Map(rows.map(row => [String(row.id), row.email]))
}

/**
 * Invitations from someone with limited invite access, to email addresses
 * and to people picked from the people search. Every valid address and
 * person counts toward the daily allowance and is reported as sent, but
 * nothing is sent to the sender, to active members, to anyone who already has
 * a pending invitation to the group, or to someone the sender blocked or was
 * blocked by, and the result does not say which. People picked from the
 * search get an in-app notification only, never an email.
 */
async function createLimitedInvitations ({ sessionUserId, groupId, emails = [], userIds = [], subject, message }) {
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
  const pickedIds = []
  for (const entry of userIds || []) {
    const id = String(entry ?? '').trim()
    if (id && !pickedIds.includes(id)) pickedIds.push(id)
  }
  if (addresses.length + pickedIds.length > InvitationSend.LIMITS.perSend) {
    throw new GraphQLError(`You can invite up to ${InvitationSend.LIMITS.perSend} email addresses at a time`)
  }

  const reachable = pickedIds.length > 0 ? await peopleSharingAGroup(sessionUserId, pickedIds) : new Map()
  for (const id of pickedIds) {
    results.push(reachable.has(id) ? { userId: id, status: 'sent' } : { userId: id, error: 'invalid' })
  }
  const people = pickedIds.filter(id => reachable.has(id))
  if (addresses.length + people.length === 0) return results

  const inviter = await User.find(sessionUserId)
  const blocked = new Set()
  if (people.length > 0) {
    const { rows } = await BlockedUser.blockedFor(sessionUserId)
    rows.forEach(row => blocked.add(String(row.user_id)))
  }
  const { emailInvitations, personInvitations } = await bookshelf.transaction(async transacting => {
    await InvitationSend.lockAllowance({ userId: sessionUserId, groupId }, { transacting })
    const remaining = await InvitationSend.remainingAllowance({ userId: sessionUserId, groupId }, { transacting })
    const counted = addresses.length + people.length
    if (counted > remaining) throw new GraphQLError('invite-limit')
    await InvitationSend.record({ userId: sessionUserId, groupId, recipients: counted }, { transacting })

    const skipped = await addressesAlreadyInGroup(groupId, addresses.concat(people.map(id => reachable.get(id))), transacting)
    skipped.add((inviter.get('email') || '').toLowerCase())
    // One invitation per address, whether it was typed or belongs to a picked person
    const invite = async email => {
      if (skipped.has(email)) return null
      skipped.add(email)
      return Invitation.create({
        email,
        userId: sessionUserId,
        groupId,
        subject,
        message: TextHelpers.markdown(message, { disableAutolinking: true }),
        inviterAccess: Invitation.InviterAccess.LIMITED
      }, { transacting })
    }

    const emailInvitations = []
    for (const email of addresses) {
      const invitation = await invite(email)
      if (invitation) emailInvitations.push(invitation)
      await recordSubmission({ userId: sessionUserId, groupId, email, invitationId: invitation?.id }, transacting)
    }
    const personInvitations = []
    for (const id of people) {
      const invitation = blocked.has(id) ? null : await invite(reachable.get(id))
      if (invitation) personInvitations.push({ inviteeId: id, invitation })
      await recordSubmission({ userId: sessionUserId, groupId, inviteeId: id, invitationId: invitation?.id }, transacting)
    }
    return { emailInvitations, personInvitations }
  })

  await Promise.map(emailInvitations, invitation =>
    Queue.classMethod('Invitation', 'createAndSend', { invitation })
      .catch(err => console.error('Error queueing invitation email', err)))

  if (personInvitations.length > 0) {
    const group = await Group.find(groupId)
    await Promise.map(personInvitations, ({ inviteeId }) =>
      notifyExistingUser({ actorId: sessionUserId, invitee: { id: inviteeId }, group })
        .catch(err => console.error('Error creating invitation notification', err)))
  }

  return results
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

  SUBMISSION_LIST_DAYS,

  /**
   * What this person submitted with limited invite access in the last
   * SUBMISSION_LIST_DAYS days and has not cancelled: the address they typed, or
   * the person they picked, and when. Every row looks the same whether or not
   * an invitation was created or has been used since, and every row leaves the
   * list on the same day, so the list never shows who was already in the group
   * or invited.
   */
  findOwnLimited: async ({ groupId, userId, limit, offset }) => {
    const rows = await bookshelf.knex('invitation_submissions')
      .leftJoin('users as invitee', 'invitee.id', 'invitation_submissions.invitee_id')
      .where({ 'invitation_submissions.group_id': groupId, 'invitation_submissions.user_id': userId })
      .whereNull('invitation_submissions.hidden_at')
      .whereRaw('invitation_submissions.created_at > now() - make_interval(days => ?)', [SUBMISSION_LIST_DAYS])
      .orderBy('invitation_submissions.created_at', 'desc')
      .orderBy('invitation_submissions.id', 'desc')
      .limit(limit || 20)
      .offset(offset || 0)
      .select(
        'invitation_submissions.id',
        'invitation_submissions.email',
        'invitation_submissions.created_at',
        'invitee.id as invitee_id',
        'invitee.name as invitee_name',
        'invitee.avatar_url as invitee_avatar_url',
        bookshelf.knex.raw('count(*) over () as total')
      )
    const total = rows.length > 0 ? Number(rows[0].total) : 0
    return {
      total,
      hasMore: (offset || 0) + rows.length < total,
      items: rows.map(row => ({
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        person: row.invitee_id
          ? { id: row.invitee_id, name: row.invitee_name, avatarUrl: row.invitee_avatar_url }
          : null
      }))
    }
  },

  /**
   * Take one of the things this person submitted off their list, and cancel
   * the invitation created for it if it is still pending. It answers the same
   * way whether or not there was an invitation.
   */
  cancelSubmission: async ({ userId, submissionId }) => {
    if (!/^\d+$/.test(String(submissionId ?? ''))) throw new GraphQLError('not found')
    return bookshelf.transaction(async transacting => {
      const submission = await bookshelf.knex('invitation_submissions')
        .where({ id: submissionId, user_id: userId })
        .whereNull('hidden_at')
        .first('id', 'invitation_id')
        .transacting(transacting)
      if (!submission) throw new GraphQLError('not found')
      if (submission.invitation_id) {
        await bookshelf.knex('group_invites')
          .where({ id: submission.invitation_id, invited_by_id: userId })
          .whereNull('used_by_id')
          .whereNull('expired_by_id')
          .update({ expired_by_id: userId, expired_at: new Date() })
          .transacting(transacting)
      }
      await bookshelf.knex('invitation_submissions')
        .where({ id: submission.id })
        .update({ hidden_at: new Date() })
        .transacting(transacting)
      return { success: true }
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
   * Send personal email invitations from someone with limited invite access,
   * and, with userIds, invite people they picked from the people search (see
   * createLimitedInvitations). Addresses are trimmed, lowercased and
   * deduplicated.
   * @returns {Object[]} { email, status: 'sent' } or { email, error: 'invalid' } for each address,
   *   and { userId, status: 'sent' } or { userId, error: 'invalid' } for each person
   */
  createLimited: ({ sessionUserId, groupId, emails, userIds, subject, message }) =>
    createLimitedInvitations({ sessionUserId, groupId, emails, userIds, subject, message }),

  /**
   * Invite people picked from the people search, from someone with limited
   * invite access: only people who share an active group with them, within
   * the same limits as email invitations, with an in-app notification and no
   * email. Anyone already in the group or invited is left out without saying so.
   */
  createLimitedForUsers: ({ sessionUserId, groupId, userIds, subject, message }) =>
    createLimitedInvitations({ sessionUserId, groupId, userIds, subject, message }),

  /** Whether people with limited invite access may pick people from the people search. */
  memberPickerEnabled: () => GroupRole.memberInvitesEnabled() && isFeatureEnabled(MEMBER_INVITE_PICKER),

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
      const memberships = await group.addMembers([userId], { joinSource: GroupMembership.JoinSource.INVITE_LINK })
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
