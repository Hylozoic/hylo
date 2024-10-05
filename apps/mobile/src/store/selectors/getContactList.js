import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { pick, sortBy, uniqBy } from 'lodash/fp'
import getMe from './getMe'

// tracks: `hylo-evo/src/routes/Messages/Messages.store.js`
export const getRecentContacts = ormCreateSelector(
  orm,
  getMe,
  ({ PersonConnection }, me) => {
    const recentContacts = PersonConnection
      .all()
      .toModelArray()
      .map(connection => presentPersonListItem(connection.person))
      .filter(filterDeletedUsers)
      .filter(p => p.id !== me.id)

    return sortByName(recentContacts)
  }
)

export const getAllContacts = ormCreateSelector(
  orm,
  getMe,
  (session, me) => {
    const allContacts = session.Person
      .all()
      .filter(filterDeletedUsers)
      .toRefArray()
      .filter(p => p.id !== me.id)

    return sortByName(allContacts)
  }
)

export const getContactsList = ormCreateSelector(
  orm,
  getMe,
  getRecentContacts,
  getAllContacts,
  (state, me, recentContacts, allContacts) => {
    return uniqBy('id', recentContacts.concat(allContacts))
  }
)

export default getContactsList

export function presentPersonListItem (person) {
  return {
    ...pick([ 'id', 'name', 'avatarUrl' ], person.ref),
    group: person.memberships.first()
      ? person.memberships.first().group.name : null
  }
}

export const sortByName = sortBy(person => person && person.name.toUpperCase())

export function filterDeletedUsers (user) {
  return user.name && !user.name.includes('Deleted User')
}
