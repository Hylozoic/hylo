import { useCallback } from 'react'
import { useQuery } from 'urql'
import useCurrentUser from './useCurrentUser'
import usePerson from './usePerson'
import commonRolesQuery from '@hylo/graphql/queries/commonRolesQuery'
import useCurrentGroup from './useCurrentGroup'

/**
 * useHasResponsibility
 *
 * A hook that returns a function to check if a given responsibility (or set of responsibilities) is present
 * for a specified groupId and person. You can optionally use bind to the currentUser or currentGroup by setting
 * either or both forCurrentGroup or forCurrentUser to true at hook instantiation. See example usage below.
 *
 * Important: If not using forCurrentUser, it is strongly recommended to pass an already-queried person object
 * rather than a personId. Otherwise, a potentially uncached query for the person will be issued, which
 * could impact performance.
 *
 * Examples:
 *
 * 1. Default usage, set the group and person at hook instantiation::
 *    const hasResponsibility = useHasResponsibility({ groupId: myGroup.id, person: myPerson })
 *    const canAdminister = hasResponsibility(RESP_ADMINISTRATION)
 *
 *    -OR- set the group and person ad hoc in the function call:
 *
 *    const hasResponsibility = useHasResponsibility()
 *    hasResponsibility(RESP_ADMINISTRATION, { person: myPerson, groupId: myGroup.id })
 *
 * 2. CurrentUser and/or CurrentGroup usage:
 *    const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
 *    const canManageContent = hasResponsibility(RESP_MANAGE_CONTENT)
 *
 * 3. Advanced usage (specify multiple groups and person/personId in hook or function call):
 *    const hasResponsibilities = useHasResponsibility({
 *      groupId: <optional>,
 *      groupIds: <optional>,
 *      person: <optional>,
 *      personId: <optional, with caution>
 *    })
 *
 *    const canAddMembersAndManageContent = hasResponsibilities(
 *      [RESP_ADD_MEMBERS, RESP_MANAGE_CONTENT],
 *      {
 *        groupId: <optional>,
 *        groupIds: <optional>,
 *        person: <optional>
 *      }
 *    )
 */

export const RESP_ADD_MEMBERS = 'Add Members'
export const RESP_ADMINISTRATION = 'Administration'
export const RESP_MANAGE_CONTENT = 'Manage Content'
export const RESP_REMOVE_MEMBERS = 'Remove Members'

export default function useHasResponsibility ({
  forCurrentGroup = false,
  forCurrentUser = false,
  groupId: hookGroupId,
  groupIds: hookGroupIds,
  personId: hookPersonId,
  person: providedHookPerson
} = {}) {
  const [{ currentGroup, fetching: currentGroupFetching, error: currentGroupError }] = useCurrentGroup({ useQueryArgs: { pause: !forCurrentGroup } })
  const [{ currentUser, fetching: currentUserFetching, error: currentUserError }] = useCurrentUser({ pause: !forCurrentUser })

  const [hookPersonById, { fetching: hookPersonByIdFetching, error: hookPersonByIdError }] = usePerson({ id: hookPersonId, pause: !hookPersonId })
  const hookPersonError = currentUserError || hookPersonByIdError
  const hookPersonFetching = hookPersonByIdFetching || currentUserFetching
  const hookPerson = providedHookPerson || hookPersonById || currentUser

  const [{ data: commonRolesData, fetching: commonRolesFetching, error: commonRolesError }] = useQuery({ query: commonRolesQuery })
  const commonRoles = commonRolesData?.commonRoles || []

  const fetching = currentGroupFetching || currentUserFetching || hookPersonFetching || commonRolesFetching

  const getGroupIdsAndPerson = useCallback(({
    person: functionPerson,
    groupId: functionGroupId,
    groupIds: functionGroupIds
  }) => {
    if (currentGroupError) {
      throw new Error('error fetching "currentGroup"')
    }

    if (hookPersonError) {
      throw new Error('error fetching "currentUser" or the provided person by "personId"')
    }

    if (commonRolesError) {
      throw new Error('error fetching "commonRoles"')
    }

    // Give dummy empty result when fetching or if currentUser is requested but empty (implies not auth'd)
    if (fetching || (forCurrentUser && !currentUser || (forCurrentGroup && !currentGroup))) {
      return { groupIds: [], person: { groupRoles: [], membershipCommonRoles: [] } }
    }

    if (!commonRoles) {
      throw new Error('"commonRoles" is empty (query failure or not authorized?)')
    }

    // The groupIds is preferred over groupId. Prefers function args before hook args.
    const rawGroupIds = functionGroupIds || functionGroupId || hookGroupIds || hookGroupId || currentGroup?.id

    if (!rawGroupIds) {
      throw new Error('No "groupId" or "groupIds" were provided either to the hook or the function call')
    }

    const groupIds = [].concat(rawGroupIds)

    const person = functionPerson || hookPerson || hookPersonById

    if (!person) {
      throw new Error(
        '"person" not resolved for hook. There was either a query failure, or the function provided "person" ' +
        'is invalid or the hook provided "personId" is not found')
    }

    return { groupIds, person }
  }, [
    currentGroupError, hookPersonError, commonRolesError, fetching, commonRoles,
    hookGroupId, hookGroupIds, currentGroup, hookPerson, hookPersonById
  ])

  const getMembershipCommonRoles = useCallback(person => {
    return person?.membershipCommonRoles?.items || []
  }, [])

  const getPersonGroupResponsibilities = useCallback((groupId, person) => {
    const groupRoles = person?.groupRoles?.items || []
    const groupRolesForGroup = groupRoles
      .filter(role => role.groupId === groupId) || []

    return groupRolesForGroup
      .flatMap(role => role?.responsibilities?.items || [])
  }, [])

  const getCommonResponsibilities = useCallback((groupId, person) => {
    const membershipCommonRoles = getMembershipCommonRoles(person)
    const membershipCommonRolesForGroup = membershipCommonRoles
      .filter(role => role.groupId === groupId)

    return commonRoles
      .filter(role => membershipCommonRolesForGroup.some(mr => mr.commonRoleId === role.id))
      .flatMap(role => role.responsibilities.items || [])
  }, [commonRoles])

  const getResponsibilities = useCallback((groupId, person) => {
    const personGroupResponsibilities = getPersonGroupResponsibilities(groupId, person)
    const commonResponsibilities = getCommonResponsibilities(groupId, person)

    return [
      ...personGroupResponsibilities,
      ...commonResponsibilities
    ]
  }, [getCommonResponsibilities])

  const hasResponsibility = useCallback((providedResponsibilities, groupIdsAndPersonArgs = {}) => {
    const { groupIds, person } = getGroupIdsAndPerson(groupIdsAndPersonArgs)

    if (!groupIds || !person) return false

    const requiredResponsibilities = [].concat(providedResponsibilities)
    const allResponsibilities = groupIds.map(groupId => (
      new Set(getResponsibilities(groupId, person).map(r => r.title))
    ))

    return requiredResponsibilities.every(required => (
      allResponsibilities.every(responsibilitiesSet => (
        responsibilitiesSet.has(required)
      ))
    ))
  }
  , [getGroupIdsAndPerson, getResponsibilities])

  return hasResponsibility
}
