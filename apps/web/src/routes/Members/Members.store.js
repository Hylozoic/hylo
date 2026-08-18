import { createSelector } from 'reselect'
import { get } from 'lodash/fp'
import { makeGetQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'

export const FETCH_MEMBERS = 'FETCH_MEMBERS'
export const FETCH_MEMBERS_FOR_GRAPH = 'FETCH_MEMBERS_FOR_GRAPH'
export const FETCH_ROLE_MEMBER_COUNTS = 'FETCH_ROLE_MEMBER_COUNTS'

export const REMOVE_MEMBER = 'REMOVE_MEMBER'
export const REMOVE_MEMBER_PENDING = REMOVE_MEMBER + '_PENDING'

export const groupMembersQuery = `
query FetchGroupMembers ($slug: String, $groupId: ID, $first: Int, $sortBy: String, $order: String, $offset: Int, $search: String, $groupRoleId: ID) {
  group (slug: $slug) {
    id
    name
    avatarUrl
    memberCount
    groupRoles {
      items {
        id
        name
        emoji
        active
        groupId
        membersTotal
        responsibilities {
          items {
            id
            title
            description
          }
        }
      }
    }
    members (first: $first, sortBy: $sortBy, order: $order, offset: $offset, search: $search, groupRoleId: $groupRoleId) {
      items {
        id
        name
        avatarUrl
        bannerUrl
        location
        tagline
        lastActiveAt
        enrolledAt
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
        groupRoles (slug: $slug) {
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

// Lean query for the skills graph: the whole membership with just enough to
// draw nodes, independent of the paginated/filtered directory list below it
const membersForGraphQuery = `
query FetchGroupMembersForGraph ($slug: String, $first: Int) {
  group (slug: $slug) {
    id
    members (first: $first, sortBy: "name", order: "asc") {
      items {
        id
        name
        avatarUrl
        lastActiveAt
        skills {
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

/**
 * Per-role member counts scoped to one group (used by spaces, whose role
 * definitions live on the parent but whose membership is its own): one
 * aliased query returns every role's in-group total in a single trip.
 */
export function fetchRoleMemberCounts ({ slug, roleIds }) {
  const safeIds = (roleIds || []).filter(id => /^\d+$/.test(String(id)))
  const fields = safeIds
    .map(id => `r${id}: members (first: 1, groupRoleId: "${id}") { total }`)
    .join('\n    ')
  return {
    type: FETCH_ROLE_MEMBER_COUNTS,
    graphql: {
      query: `query FetchRoleMemberCounts ($slug: String) {
  group (slug: $slug) {
    id
    ${fields}
  }
}`,
      variables: { slug }
    }
  }
}

export function fetchMembersForGraph ({ slug, first = 2000 }) {
  return {
    type: FETCH_MEMBERS_FOR_GRAPH,
    graphql: {
      query: membersForGraphQuery,
      variables: { slug, first }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members'),
        replace: true,
        getRouteParams: action => ({ slug: action.meta.graphql.variables.slug })
      }
    }
  }
}

function defaultOrderForSort (sortBy) {
  if (sortBy === 'join' || sortBy === 'last_active_at') return 'desc'
  return 'asc'
}

export function getMemberQueryProps ({ slug, search, sortBy, groupRoleId }) {
  return {
    slug,
    search,
    sortBy,
    groupRoleId: groupRoleId || null,
    order: defaultOrderForSort(sortBy)
  }
}

export function fetchGroupMembers ({ slug, groupId, sortBy, order, offset, search, groupRoleId, first = 20 }) {
  return {
    type: FETCH_MEMBERS,
    graphql: {
      query: groupMembersQuery,
      variables: {
        slug,
        groupId,
        first,
        offset,
        sortBy,
        order: order || defaultOrderForSort(sortBy),
        search,
        groupRoleId: groupRoleId || null
      }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members'),
        replace: !offset,
        getRouteParams: action => getMemberQueryProps(action.meta.graphql.variables)
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
export function fetchMembers ({ slug, groupId, sortBy, offset, search, groupRoleId }) {
  return fetchGroupMembers({ slug, groupId, sortBy, offset, search, groupRoleId })
}

export default function reducer (state = {}, action) {
  return state
}

const getMemberResults = makeGetQueryResults(FETCH_MEMBERS)

export const getHasFetchedMembers = createSelector(
  getMemberResults,
  results => results != null
)

export const getMembers = makeQueryResultsModelSelector(
  getMemberResults,
  'Person',
  person => ({
    ...person.ref,
    skills: person.skills.toModelArray()
  })
)

const getGraphMemberResults = makeGetQueryResults(FETCH_MEMBERS_FOR_GRAPH)

export const getHasFetchedGraphMembers = createSelector(
  getGraphMemberResults,
  results => results != null
)

export const getGraphMembers = makeQueryResultsModelSelector(
  getGraphMemberResults,
  'Person',
  person => ({
    ...person.ref,
    skills: person.skills.toModelArray()
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
