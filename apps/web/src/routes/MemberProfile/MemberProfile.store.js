import { createSelector } from 'reselect'
import getPerson from 'store/selectors/getPerson'
import { isSpaceGroup } from 'store/selectors/getMyGroups'

export const FETCH_RECENT_ACTIVITY = 'FETCH_RECENT_ACTIVITY'
export const FETCH_MEMBER_POSTS = 'FETCH_MEMBER_POSTS'
export const FETCH_MEMBER_COMMENTS = 'FETCH_MEMBER_COMMENTS'
export const FETCH_MEMBER_REACTIONS = 'FETCH_MEMBER_REACTIONS'

/** Profile memberships exclude spaces so Hylo Groups lists top-level groups only. */
export function getMemberships (person) {
  return person.memberships.toModelArray()
    .filter(membership => !isSpaceGroup(membership.group))
    .map(membership => ({
      ...membership.ref,
      group: membership.group.ref
    }))
}

export function presentPerson (person, selectedGroupSlug) {
  return {
    ...person.ref,
    skills: person.skills && person.skills.toRefArray(),
    memberships: getMemberships(person),
    groupRoles: person.groupRoles
  }
}

export const getPresentedPerson = createSelector(
  getPerson,
  (state, { slug }) => slug,
  (person, slug) => person && presentPerson(person, slug)
)
