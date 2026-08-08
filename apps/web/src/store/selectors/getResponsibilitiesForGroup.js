import { createSelector } from 'reselect'
import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import getMe from './getMe'

/**
 * Responsibilities the person holds in a group.
 * Spaces inherit role assignments from their parent group (roles are not stored on spaces).
 */
const getResponsibilitiesForGroup = ormCreateSelector(
  orm,
  (state, props) => props.person || getMe(state),
  (state, props) => props.groupId,
  (session, person, groupId) => {
    if (!person || !groupId) return []

    // Spaces inherit roles from parent — match role.groupId against parentId when set
    const group = session.Group.safeGet({ id: groupId })
    const roleScopeId = group?.parentId || groupId

    return (person.groupRoles?.items || [])
      .filter(role => String(role.groupId) === String(roleScopeId))
      .flatMap(role => role.responsibilities?.items || [])
  }
)

export const getResponsibilityTitlesForGroup = createSelector(
  getResponsibilitiesForGroup,
  (responsibilities) => responsibilities.map(r => r.title)
)

export default getResponsibilitiesForGroup
