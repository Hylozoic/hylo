import React, { useCallback, useMemo } from 'react'
import { useQuery } from 'urql'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import commonRolesQuery from 'graphql/queries/commonRolesQuery'
import { isContextGroup } from 'urql-shared/presenters/GroupPresenter'

export default function useHasResponsibility (groupId, providedPerson) {
  const currentUser = useCurrentUser()
  const person = providedPerson || currentUser
  const skipQueries = !groupId || isContextGroup(groupId)

  // Fetch data from queries if not skipped
  const [{ data: commonRolesData, fetching: fetchingCommonRoles }] = useQuery({
    query: commonRolesQuery,
    pause: skipQueries
  })

  const isFetching = fetchingCommonRoles || skipQueries

  const derivePersonGroupResponsibilities = (person) => {
    const groupRoles = person?.groupRoles?.items || []
    const groupRolesForGroup = groupRoles.filter(role => role.groupId === groupId) || []
    return groupRolesForGroup.flatMap(role => role?.responsibilities?.items || [])
  }

  const deriveCommonResponsibilities = (commonRolesData, person) => {
    const commonRoles = commonRolesData?.commonRoles || []
    const membershipRoles = person?.membershipCommonRoles?.items || []
    const membershipRolesForGroup = membershipRoles.filter(role => role.groupId === groupId)

    return commonRoles
      .filter(role => membershipRolesForGroup.some(mr => mr.commonRoleId === role.id))
      .flatMap(role => role.responsibilities.items || [])
  }

  // Memoize derived responsibilities
  const personGroupResponsibilities = useMemo(() => derivePersonGroupResponsibilities(person), [person, groupId])
  const commonResponsibilities = useMemo(() => deriveCommonResponsibilities(commonRolesData, person), [commonRolesData, person, groupId])

  const responsibilities = useMemo(() => [
    ...personGroupResponsibilities,
    ...commonResponsibilities
  ], [personGroupResponsibilities, commonResponsibilities])

  // Callback to check responsibilities
  const hasResponsibility = useCallback((responsibility) => {
    const requiredResponsibilities = Array.isArray(responsibility) ? responsibility : [responsibility]

    // Steward case?
    if (responsibility === null) {
      // TODO: Shouldn't the '1', etc values be taken from constants?
      return responsibilities.some(r => ['1', '3', '4'].includes(r.id))
    }

    return responsibilities.some(r => requiredResponsibilities.includes(r.title))
  }, [responsibilities])

  return isFetching ? () => false : hasResponsibility
}
