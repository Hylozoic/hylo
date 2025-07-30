import { createSelector } from 'reselect'
import { get } from 'lodash/fp'
import { makeGetQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'

export const FETCH_MEMBERS = 'FETCH_MEMBERS'

export const REMOVE_MEMBER = 'REMOVE_MEMBER'
export const REMOVE_MEMBER_PENDING = REMOVE_MEMBER + '_PENDING'

export const groupMembersQuery = `
query FetchGroupMembers ($slug: String, $groupId: ID, $first: Int, $sortBy: String, $order: String, $offset: Int, $search: String) {
  group (slug: $slug) {
    id
    name
    avatarUrl
    memberCount
    members (first: $first, sortBy: $sortBy, order: $order, offset: $offset, search: $search) {
      items {
        id
        name
        avatarUrl
        bannerUrl
        location
        tagline
        lastActiveAt
        groupJoinQuestionAnswers (groupId: $groupId) {
          items {
            id
            question {
              id
              text
            }
            answer
          }
        }
        groupRoles {
          items {
            id
            name
            emoji
            active
            groupId
            responsibilities {
              items {
                id
                title
                description
              }
            }
          }
        }
        membershipCommonRoles {
          items {
            id
            commonRoleId
            groupId
            userId
          }
        }
        skills {
          hasMore
          items {
            id
            name
          }
        }
      }
      hasMore
    }
  }
}`

export function fetchGroupMembers ({ slug, groupId, sortBy, order, offset, search, first = 20 }) {
  return {
    type: FETCH_MEMBERS,
    graphql: {
      query: groupMembersQuery,
      variables: { slug, groupId, first, offset, sortBy, order, search }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members')
      }
    }
  }
}

export function removeMember (personId, groupId, slug) {
  return {
    type: REMOVE_MEMBER,
    graphql: {
      query: `mutation($personId: ID, $groupId: ID) {
        removeMember(personId: $personId, groupId: $groupId) {
          id
          memberCount
        }
      }`,
      variables: { personId, groupId }
    },
    meta: {
      slug,
      personId,
      groupId
    }
  }
}
// I don't know why there is this duplication (see fetchGroupMembers). Not taking the time to refactor.
export function fetchMembers ({ slug, groupId, sortBy, offset, search }) {
  return fetchGroupMembers({ slug, groupId, sortBy, offset, search })
}

export default function reducer (state = {}, action) {
  return state
}

const getMemberResults = makeGetQueryResults(FETCH_MEMBERS)

export const getMembers = makeQueryResultsModelSelector(
  getMemberResults,
  'Person',
  person => ({
    ...person.ref,
    skills: person.skills.toModelArray(),
    membershipCommonRoles: person.membershipCommonRoles.toModelArray()
  })
)

export const getHasMoreMembers = createSelector(
  getMemberResults,
  get('hasMore')
)

export function ormSessionReducer ({ Group }, { meta, type }) {
  if (type === REMOVE_MEMBER_PENDING) {
    const group = Group.withId(meta.groupId)
    const members = group.members.filter(m => m.id !== meta.personId)
      .toModelArray()
    group.update({ members, memberCount: group.memberCount - 1 })
  }
}
