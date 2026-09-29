import { GraphQLError } from 'graphql'
import InvitationService from '../../services/InvitationService'

/**
 * The member invitation a join request comes from: the one whose token the
 * requester followed, which must be a pending member invitation to this group,
 * or else a pending member invitation to the requester's email address there.
 */
async function sponsoringInvitation (userId, groupId, invitationToken) {
  if (invitationToken) {
    const invitation = await Invitation.where({ token: invitationToken }).fetch()
    if (!invitation || !invitation.isLimited() || invitation.isUsed() || invitation.isExpired() ||
      String(invitation.get('group_id')) !== String(groupId)) {
      throw new GraphQLError('This invitation cannot be used to request to join this group')
    }
    return invitation
  }
  const user = await User.find(userId)
  if (!user?.get('email')) return null
  return Invitation.query(q => {
    q.where({ group_id: groupId, inviter_access: Invitation.InviterAccess.LIMITED })
    q.whereNull('used_by_id')
    q.whereNull('expired_by_id')
    q.whereRaw('lower(email) = lower(?)', [user.get('email')])
    q.orderBy('created_at', 'asc')
  }).fetch()
}

/**
 * The member's personal invite link a join request comes from, when the requester
 * followed one: it must still be usable and be for this group, and the person counts
 * toward its owner's invitations for the day.
 */
async function sponsoringMemberLink (groupId, accessCode) {
  const memberLink = await InvitationService.usableMemberLink(accessCode)
  if (!memberLink || String(memberLink.group.id) !== String(groupId)) {
    throw new GraphQLError('This invitation cannot be used to request to join this group')
  }
  return memberLink.link
}

export async function createJoinRequest (userId, groupId, questionAnswers = [], invitationToken, accessCode) {
  if (groupId && userId) {
    const memberLink = accessCode ? await sponsoringMemberLink(groupId, accessCode) : null
    const invitation = memberLink ? null : await sponsoringInvitation(userId, groupId, invitationToken)
    const pendingRequest = await JoinRequest.where({ user_id: userId, group_id: groupId, status: JoinRequest.STATUS.Pending }).fetch()
    const sponsored = request => request.get('invitation_id') || request.get('member_invite_link_id')
    if (pendingRequest) {
      if (invitation && !sponsored(pendingRequest)) {
        await pendingRequest.save({ invitation_id: invitation.id }, { patch: true })
      } else if (memberLink && !sponsored(pendingRequest)) {
        await InvitationService.spendMemberLinkAllowance(memberLink)
        await pendingRequest.save({ member_invite_link_id: memberLink.id }, { patch: true })
      }
      return { request: pendingRequest }
    }
    if (memberLink) await InvitationService.spendMemberLinkAllowance(memberLink)
    // If there's an existing processed request then let's leave it and create a new one
    // Maybe they left the group and want back in? Or maybe initial request was rejected
    return JoinRequest.create({
      userId,
      groupId,
      invitationId: invitation ? invitation.id : null,
      memberInviteLinkId: memberLink ? memberLink.id : null
    })
      .then(async (request) => {
        for (const qa of questionAnswers) {
          await GroupJoinQuestionAnswer.forge({ group_id: groupId, join_request_id: request.id, question_id: qa.questionId, answer: qa.answer, user_id: userId }).save()
        }
        return { request }
      })
  } else {
    throw new GraphQLError('Invalid parameters to create join request')
  }
}

export async function acceptJoinRequest (userId, joinRequestId) {
  const joinRequest = await JoinRequest.find(joinRequestId)
  if (joinRequest) {
    if (await GroupMembership.hasResponsibility(userId, joinRequest.get('group_id'), Responsibility.constants.RESP_ADD_MEMBERS)) {
      return joinRequest.accept(userId)
    } else {
      throw new GraphQLError('You do not have permission to accept a join request')
    }
  } else {
    throw new GraphQLError('Invalid parameters to accept join request')
  }
}

export async function cancelJoinRequest (userId, joinRequestId) {
  const joinRequest = await JoinRequest.find(joinRequestId)
  if (joinRequest) {
    if (joinRequest.get('user_id') === userId) {
      await joinRequest.cancel()
      return { success: true }
    } else {
      throw new GraphQLError('You do not have permission to do this')
    }
  } else {
    throw new GraphQLError('Invalid parameters to cancel join request')
  }
}

export async function declineJoinRequest (userId, joinRequestId) {
  const joinRequest = await JoinRequest.find(joinRequestId)
  if (joinRequest) {
    if (await GroupMembership.hasResponsibility(userId, joinRequest.get('group_id'), Responsibility.constants.RESP_ADD_MEMBERS)) {
      await joinRequest.decline(userId)
      return joinRequest
    } else {
      throw new GraphQLError('You do not have permission to do this')
    }
  } else {
    throw new GraphQLError('Invalid parameters to decline join request')
  }
}
