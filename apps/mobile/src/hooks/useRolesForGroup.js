import { useMemo } from 'react'
import { useQuery } from 'urql'
import commonRolesQuery from 'graphql/queries/commonRolesQuery'

export default function useRolesForGroup (groupId, person) {
  const [{ data: commonRolesData, fetching: commonRolesFetching }] = useQuery({ query: commonRolesQuery })

  const commonRoles = commonRolesData?.commonRoles || []
  const personGroupRoles = person?.groupRoles?.items || []
  const membershipCommonRoles = person?.membershipCommonRoles?.items || []

  const membershipCommonRolesForGroup = useMemo(() => {
    return membershipCommonRoles.filter(membershipCommonRole => membershipCommonRole.groupId === groupId)
  }, [membershipCommonRoles, groupId])

  const filteredCommonRoles = useMemo(() => {
    return commonRoles
      .filter(commonRole =>
        membershipCommonRolesForGroup.find(
          membershipCommonRole => membershipCommonRole.commonRoleId === commonRole.id
        )
      )
      .map(commonRole => ({ ...commonRole, common: true }))
  }, [commonRoles, membershipCommonRolesForGroup])

  const rolesForGroup = useMemo(() => {
    return personGroupRoles.length
      ? filteredCommonRoles.concat(personGroupRoles.filter(groupRole => groupRole.groupId === groupId))
      : filteredCommonRoles
  }, [filteredCommonRoles, personGroupRoles, groupId])

  if (commonRolesFetching) return []

  return rolesForGroup
}
