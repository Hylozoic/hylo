export const RESP_ADD_MEMBERS = 'Add Members'
export const RESP_ADMINISTRATION = 'Administration'
export const RESP_MANAGE_CONTENT = 'Manage Content'
export const RESP_REMOVE_MEMBERS = 'Remove Members'

export const SYSTEM_ROLE_NAMES = ['Coordinator', 'Moderator', 'Host']

/**
 * Whether a group role is a built-in system role.
 */
export function isSystemGroupRole (role) {
  return role?.type === 'system'
}

/**
 * Sort system group roles in Coordinator, Moderator, Host order.
 */
export function sortSystemGroupRoles (roles) {
  return [...(roles || [])].filter(isSystemGroupRole).sort((a, b) => {
    const aIndex = SYSTEM_ROLE_NAMES.indexOf(a.name)
    const bIndex = SYSTEM_ROLE_NAMES.indexOf(b.name)
    return (aIndex === -1 ? SYSTEM_ROLE_NAMES.length : aIndex) -
      (bIndex === -1 ? SYSTEM_ROLE_NAMES.length : bIndex)
  })
}

/**
 * Active group roles for pickers: system roles (Coordinator, Moderator, Host) first, then custom.
 */
export function groupRolesForPicker (roles) {
  const active = (roles || []).filter(role => role?.id != null && role.active !== false)
    .map(role => SYSTEM_ROLE_NAMES.includes(role.name) ? { ...role, type: 'system' } : role)
  return [
    ...sortSystemGroupRoles(active),
    ...sortCustomGroupRoles(active.filter(role => !isSystemGroupRole(role)))
  ].map(role => ({
    ...role,
    id: String(role.id),
    label: `${role.emoji || ''} ${role.name}`.trim()
  }))
}

/**
 * Sort custom group roles by id, with unsaved roles (no id) last.
 */
export function sortCustomGroupRoles (roles) {
  return [...(roles || [])].sort((a, b) => {
    const aId = a.id != null ? parseInt(a.id, 10) : NaN
    const bId = b.id != null ? parseInt(b.id, 10) : NaN
    if (isNaN(aId) && isNaN(bId)) return 0
    if (isNaN(aId)) return 1
    if (isNaN(bId)) return -1
    return aId - bId
  })
}

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
