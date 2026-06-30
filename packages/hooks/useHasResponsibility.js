import { useCallback } from 'react'
import useCurrentUser from './useCurrentUser'
import usePerson from './usePerson'
import useCurrentGroup from './useCurrentGroup'
import { getResponsibilitiesForGroup } from './groupRoleHelpers'

export {
  RESP_ADD_MEMBERS,
  RESP_ADMINISTRATION,
  RESP_MANAGE_CONTENT,
  RESP_REMOVE_MEMBERS
} from './groupRoleHelpers'

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

  const fetching = currentGroupFetching || currentUserFetching || hookPersonFetching

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

    if (fetching || (forCurrentUser && !currentUser || (forCurrentGroup && !currentGroup))) {
      return { groupIds: [], person: { groupRoles: { items: [] } } }
    }

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
    currentGroupError, hookPersonError, fetching, forCurrentUser, forCurrentGroup,
    currentUser, currentGroup, hookGroupId, hookGroupIds, hookPerson, hookPersonById
  ])

  const getResponsibilities = useCallback((groupId, person) => {
    return getResponsibilitiesForGroup(person, groupId)
  }, [])

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
  }, [getGroupIdsAndPerson, getResponsibilities])

  return hasResponsibility
}
