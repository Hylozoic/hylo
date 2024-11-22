import { useCallback, useMemo } from 'react'
import { useQuery } from 'urql'
import useCurrentUser from 'hooks/useCurrentUser'
import commonRolesQuery from 'graphql/queries/commonRolesQuery'
import { isContextGroup } from 'urql-shared/presenters/GroupPresenter'

// TODO: Convert to allow a single or multiple groups to be provided to hasResponsibility, see: https://github.com/Hylozoic/hylo/issues/87
export default function useHasResponsibility (groupId, providedPerson) {
  const [currentUser] = useCurrentUser()
  const person = providedPerson || currentUser
  const skipQueries = !groupId || isContextGroup(groupId)

  // Fetch data from queries if not skipped
  const [{ data: commonRolesData, fetching: fetchingCommonRoles }] = useQuery({
    query: commonRolesQuery,
    pause: skipQueries
  })

  const isFetching = fetchingCommonRoles || skipQueries

  const personGroupResponsibilities = useMemo(() => {
    const groupRoles = person?.groupRoles?.items || []
    const groupRolesForGroup = groupRoles
      .filter(role => role.groupId === groupId) || []
    return groupRolesForGroup
      .flatMap(role => role?.responsibilities?.items || [])
  }, [person, groupId])

  const commonResponsibilities = useMemo(() => {
    const commonRoles = commonRolesData?.commonRoles || []
    const membershipCommonRoles = person?.membershipCommonRoles?.items || []
    const membershipCommonRolesForGroup = membershipCommonRoles
      .filter(role => role.groupId === groupId)

    return commonRoles
      .filter(role => membershipCommonRolesForGroup.some(mr => mr.commonRoleId === role.id))
      .flatMap(role => role.responsibilities.items || [])
  }, [commonRolesData, person, groupId])

  const responsibilities = useMemo(() => ([
    ...personGroupResponsibilities,
    ...commonResponsibilities
  ]), [personGroupResponsibilities, commonResponsibilities])

  const hasResponsibility = useCallback(responsibility => {
    const requiredResponsibilities = Array.isArray(responsibility) ? responsibility : [responsibility]

    // TODO: URQL - Steward case? -- https://terrans.slack.com/archives/G01HM5VHD8X/p1732263229830789
    if (responsibility === null) {
      // TODO: Shouldn't the '1', etc values be taken from constants?
      return responsibilities.some(r => ['1', '3', '4'].includes(r.id))
    }

    return responsibilities.some(r => requiredResponsibilities.includes(r.title))
  }, [responsibilities])

  return isFetching ? () => false : hasResponsibility
}
