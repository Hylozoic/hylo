export const RESP_ADD_MEMBERS = 'Add Members'
export const RESP_ADMINISTRATION = 'Administration'
export const RESP_MANAGE_CONTENT = 'Manage Content'
export const RESP_REMOVE_MEMBERS = 'Remove Members'

/**
 * Returns responsibilities from a person's assigned group roles in a group.
 */
export function getResponsibilitiesForGroup (person, groupId) {
  if (!person || !groupId) return []

  return (person?.groupRoles?.items || [])
    .filter(role => role.groupId === groupId)
    .flatMap(role => role?.responsibilities?.items || [])
}

/**
 * Returns whether a person has Administration responsibility in a group.
 */
export function hasAdministrationInGroup (person, groupId) {
  return getResponsibilitiesForGroup(person, groupId)
    .some(r => r.title === RESP_ADMINISTRATION)
}
