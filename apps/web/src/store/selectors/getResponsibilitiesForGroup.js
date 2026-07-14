import { createSelector } from 'reselect'
import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import getMe from './getMe'

const getResponsibilitiesForGroup = ormCreateSelector(
  orm,
  (state, props) => props.person || getMe(state),
  (state, props) => props.groupId,
  (session, person, groupId) => {
    if (!person || !groupId) return []

    return (person.groupRoles?.items || [])
      .filter(role => role.groupId === groupId)
      .flatMap(role => role.responsibilities?.items || [])
  }
)

export const getResponsibilityTitlesForGroup = createSelector(
  getResponsibilitiesForGroup,
  (responsibilities) => responsibilities.map(r => r.title)
)

export default getResponsibilitiesForGroup
