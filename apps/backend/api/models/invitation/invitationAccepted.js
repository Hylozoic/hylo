/* global Activity, GroupMembership, GroupRole, Invitation */

// The reason on the notice to the person whose invitation was accepted (D47)
export const INVITATION_ACCEPTED = 'invitationAccepted'

// The ways in that come from someone's invitation. The group's own join link
// names no inviter, so it never tells anyone.
const invitedJoinSources = () => {
  const { EMAIL_INVITE, JOIN_REQUEST, MEMBER_LINK } = GroupMembership.JoinSource
  return [EMAIL_INVITE, MEMBER_LINK, JOIN_REQUEST]
}

/**
 * Whether this join came through a member's invitation rather than a steward's:
 * a member's personal invite link, a request a member's invitation or link led
 * to, or a member's email invitation.
 */
async function fromMemberInvite ({ joinSource, invitationId }) {
  const { JOIN_REQUEST, MEMBER_LINK } = GroupMembership.JoinSource
  if (joinSource === MEMBER_LINK || joinSource === JOIN_REQUEST) return true
  if (!invitationId) return false
  const invitation = await Invitation.where({ id: invitationId }).fetch()
  return !!invitation && invitation.isLimited()
}

/** Whether the inviter is still in the group, or in the group a space belongs to. */
async function inviterStillIn (inviterId, group) {
  const groupIds = [group.id, group.get('parent_id')].filter(Boolean)
  for (const groupId of groupIds) {
    if (await GroupMembership.forPair(inviterId, groupId).fetch()) return true
  }
  return false
}

/**
 * Tell the person whose invitation someone accepted that they joined, in the
 * app and by push ('<Name> joined <group>, say hi'). Called after people join or
 * rejoin a group with an inviter recorded on their membership. Nobody is told
 * about joining through the group's own join link, about inviting themselves, or
 * when the inviter has left the group since. Joins through a member's
 * invitation or invite link tell the member only while member invitations are
 * switched on.
 * @returns the number of notices queued
 */
export default async function notifyInviterOfJoin ({ group, userIds = [], invitedById, joinSource, invitationId }) {
  if (!group || !invitedById || !invitedJoinSources().includes(joinSource)) return 0
  const joinedIds = userIds.filter(id => id && String(id) !== String(invitedById))
  if (joinedIds.length === 0) return 0
  if (await fromMemberInvite({ joinSource, invitationId }) && !GroupRole.memberInvitesEnabled()) return 0
  if (!await inviterStillIn(invitedById, group)) return 0

  // One activity each, so several people joining at once each get their own notice
  for (const userId of joinedIds) {
    await Activity.saveForReasons([{
      actor_id: userId,
      reader_id: invitedById,
      group_id: group.id,
      reason: INVITATION_ACCEPTED
    }])
  }
  return joinedIds.length
}
