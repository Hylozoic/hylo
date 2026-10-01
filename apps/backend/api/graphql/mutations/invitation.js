import { GraphQLError } from 'graphql'
import { getLocaleStrings } from '../../../lib/i18n/locales'
import InvitationService from '../../services/InvitationService'

export async function createInvitation (userId, groupId, data) {
  const group = await Group.find(groupId)
  const user = await User.find(userId)
  const localeStrings = getLocaleStrings(user.getLocale())
  return GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADD_MEMBERS)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to create an invitation for this group")
    })
    .then(() => Group.find(groupId))
    .then(async (group) => {
      if (!group) throw new GraphQLError('Cannot find group to send invites for')

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
  return InvitationService.checkPermission(userId, invitationId)
    .then(ok => {
      if (!ok) throw new GraphQLError("You don't have permission to modify this invitation")
    })
    .then(() => InvitationService.expire(userId, invitationId))
    .then(() => ({ success: true }))
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
    .then(membership => ({ membership }))
    .catch(error => ({ error: error.message }))
}
