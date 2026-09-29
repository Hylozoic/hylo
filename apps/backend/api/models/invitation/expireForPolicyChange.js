/* global bookshelf, GroupMembership, GroupRole, Invitation */

/**
 * After "Who can add new members?" narrows, or a role loses Invite Members or is
 * deactivated, expire the pending member invitations (inviter_access 'limited')
 * in the group whose senders can no longer invite. Invitations from people who
 * still can are left alone. Pass the transaction the change was made in so the
 * change is seen. Does nothing while member invitations are switched off, when
 * nobody has limited access and every pending one would otherwise be expired.
 * Returns the ids of the senders whose invitations were expired.
 */
export default async function expireForPolicyChange (groupId, { transacting } = {}) {
  if (!groupId || !GroupRole.memberInvitesEnabled()) return []

  let sendersQuery = bookshelf.knex('group_invites')
    .distinct('invited_by_id')
    .where({ group_id: groupId, inviter_access: 'limited' })
    .whereNull('used_by_id')
    .whereNull('expired_by_id')
    .whereNotNull('invited_by_id')
  if (transacting) sendersQuery = sendersQuery.transacting(transacting)
  const senderIds = (await sendersQuery).map(row => row.invited_by_id)
  if (senderIds.length === 0) return []

  const lostAccess = []
  for (const senderId of senderIds) {
    const access = await GroupMembership.inviteAccess(senderId, groupId, { transacting })
    if (!access) lostAccess.push(senderId)
  }
  if (lostAccess.length > 0) {
    await Invitation.expirePendingLimited({ groupId, invitedByIds: lostAccess }, { transacting })
  }
  return lostAccess
}

/**
 * Whether going from one invite policy ({ mode, roleIds }) to another can take
 * invite access away from someone: everyone to anything else, or specific roles
 * to stewards or to a set that leaves out a role.
 */
export function invitePolicyNarrowed (before, after) {
  if (!before || !after) return false
  if (before.mode === 'everyone') return after.mode !== 'everyone'
  if (before.mode !== 'roles' || after.mode === 'everyone') return false
  if (after.mode === 'stewards') return true
  const kept = new Set((after.roleIds || []).map(String))
  return (before.roleIds || []).some(id => !kept.has(String(id)))
}
