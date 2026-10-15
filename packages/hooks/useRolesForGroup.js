import { useMemo } from 'react'
import { isImplicitMemberRole } from './groupRoleHelpers'

/**
 * Roles to display for a person in a group. The implicit All Members role is omitted.
 */
export default function useRolesForGroup (groupId, person) {
  return useMemo(() => {
    return (person?.groupRoles?.items || []).filter(role =>
      role.groupId === groupId && !isImplicitMemberRole(role)
    )
  }, [person?.groupRoles?.items, groupId])
}
