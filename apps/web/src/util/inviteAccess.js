/**
 * 'full' for people who can add members, otherwise null.
 */
export function inviteAccessFor (group, canAddMembers) {
  if (!group?.id || !canAddMembers) return null
  return 'full'
}
