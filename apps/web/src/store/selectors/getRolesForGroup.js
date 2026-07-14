import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import getMe from './getMe'

const getRolesForGroup = ormCreateSelector(
  orm,
  (state, props) => props.person || getMe(state),
  (state, props) => props.groupId,
  (session, person, groupId) => {
    if (typeof person === 'number' || typeof person === 'string') {
      person = session.Me.withId(person) || session.Person.withId(person)
    }
    if (!person || !groupId) {
      return []
    }

    return (person.groupRoles?.items || []).filter(role => role.groupId === groupId)
  }
)

export default getRolesForGroup
