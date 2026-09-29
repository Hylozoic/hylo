import { GraphQLError } from 'graphql'
import { isEmpty } from 'lodash'
import { getLocaleStrings } from '../../../lib/i18n/locales'
import InvitationService from '../../services/InvitationService'

/**
 * Personal invitations from someone with limited invite access: no roles, top-level
 * groups only, and existing Hylo people by id only while the member people picker
 * is switched on.
 */
async function createLimitedInvitations (userId, group, data, localeStrings) {
  if (group.get('type') === 'space' || group.get('parent_id')) {
    throw new GraphQLError("You don't have permission to create an invitation for this group")
  }
  if (data.groupRoleId || data.assignAdministrator) {
    throw new GraphQLError("You don't have permission to invite people with a role")
  }
  if (!isEmpty(data.userIds) && !InvitationService.memberPickerEnabled()) {
    throw new GraphQLError('You can only invite people by email address')
  }
  const invitations = await InvitationService.createLimited({
    sessionUserId: userId,
    groupId: group.id,
    emails: data.emails,
    userIds: data.userIds,
    message: localeStrings.createInvitationMessage(group.get('name')),
    subject: localeStrings.createInvitationSubject(group.get('name'))
  })
  return { invitations }
}

export async function createInvitation (userId, groupId, data) {
  const group = await Group.find(groupId)
  const user = await User.find(userId)
  const localeStrings = getLocaleStrings(user.getLocale())
  const inviteAccess = group ? await GroupMembership.inviteAccess(userId, group) : null
  if (inviteAccess === GroupMembership.InviteAccess.LIMITED) {
    return createLimitedInvitations(userId, group, data || {}, localeStrings)
  }
  return Promise.resolve(inviteAccess === GroupMembership.InviteAccess.FULL)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to create an invitation for this group")
    })
    .then(() => Group.find(groupId))
    .then(async (group) => {
      if (!group) throw new GraphQLError('Cannot find group to send invites for')
      await GroupRole.assertAssignableRoleIds(data.groupRoleId)

      // Defensive check: when inviting specific users (userIds) to a role-gated
      // space, verify each target user has one of the required roles.
      const requiredRoles = group.get('required_roles')
      const isRoleGated = Array.isArray(requiredRoles) && requiredRoles.length > 0
      if (isRoleGated && Array.isArray(data.userIds) && data.userIds.length > 0) {
        for (const targetUserId of data.userIds) {
          if (!targetUserId) continue
          const parentId = group.get('parent_id')
          const memberRoleIds = await bookshelf.knex('group_memberships_group_roles')
            .where({ user_id: targetUserId, group_id: parentId, active: true })
            .pluck('group_role_id')
          const memberRoleIdSet = new Set(memberRoleIds.map(id => String(id)))
          if (!requiredRoles.some(roleId => memberRoleIdSet.has(String(roleId)))) {
            const targetUser = await User.find(targetUserId)
            const name = targetUser ? targetUser.get('name') : targetUserId
            throw new GraphQLError(`${name} does not have the required role to join this space`)
          }
        }
      }

      return InvitationService.create({
        sessionUserId: userId,
        groupId,
        emails: data.emails,
        userIds: data.userIds,
        message: localeStrings.createInvitationMessage(group.get('name')),
        assignAdministrator: data.assignAdministrator || false,
        groupRoleId: data.groupRoleId ? parseInt(data.groupRoleId, 10) : null,
        subject: localeStrings.createInvitationSubject(group.get('name'))
      })
    })
    .then(invitations => ({ invitations }))
}

export function expireInvitation (userId, invitationId) {
  return InvitationService.canExpire(userId, invitationId)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to modify this invitation")
    })
    .then(() => InvitationService.expire(userId, invitationId))
    .then(() => ({ success: true }))
}

// The group whose personal invite link this person may have: one they can invite people to with limited access
async function memberInviteLinkGroup (userId, groupId) {
  const group = groupId && await Group.find(groupId)
  if (!group || await GroupMembership.inviteAccess(userId, group) !== GroupMembership.InviteAccess.LIMITED) {
    throw new GraphQLError("You don't have permission to create an invite link for this group")
  }
  return group
}

const inviteLinkResult = (link, group) => ({ path: link.path(group), createdAt: link.get('created_at') })

/** This person's personal invite link to the group, made now if they have none. */
export async function createMemberInviteLink (userId, groupId) {
  const group = await memberInviteLinkGroup(userId, groupId)
  return inviteLinkResult(await MemberInviteLink.findOrCreate({ groupId: group.id, userId }), group)
}

/** Stop this person's personal invite link to the group working, and make a new one. */
export async function resetMemberInviteLink (userId, groupId) {
  const group = await memberInviteLinkGroup(userId, groupId)
  return inviteLinkResult(await MemberInviteLink.reset({ groupId: group.id, userId }), group)
}

/**
 * Take one of the addresses or people this person submitted with limited invite access
 * off their list, cancelling its invitation if one is still pending.
 */
export async function cancelInvitationSubmission (userId, submissionId) {
  if (!userId) throw new GraphQLError("You don't have permission to modify this invitation")
  return InvitationService.cancelSubmission({ userId, submissionId })
}

export function resendInvitation (userId, invitationId) {
  return InvitationService.checkPermission(userId, invitationId)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to modify this invitation")
    })
    .then(() => InvitationService.resend(invitationId))
    .then(() => ({ success: true }))
}

export async function reinviteAll (userId, groupId) {
  const group = await Group.find(groupId)
  return GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADD_MEMBERS)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to modify this invitation")
    })
    .then(() => InvitationService.reinviteAll({ sessionUserId: userId, groupId }))
    .then(() => ({ success: true }))
}

export function useInvitation (userId, invitationToken, accessCode) {
  return InvitationService.use(userId, invitationToken, accessCode)
    .then(result => result?.requiresApproval ? result : { membership: result })
    .catch(error => ({ error: error.message }))
}
