import { useMemo } from 'react'

export default function useRolesForGroup (groupId, person) {
  return useMemo(() => {
    return (person?.groupRoles?.items || []).filter(role => role.groupId === groupId)
  }, [person?.groupRoles?.items, groupId])
}
