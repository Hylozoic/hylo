import { get } from 'lodash/fp'
import { createSelector } from 'reselect'
import { FETCH_GROUPS } from 'store/constants'
import { makeGetQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'

export function fetchGroups ({ allowedInPublic, farmQuery, groupType, nearCoord, offset, order, pageSize = 20, search, slug, sortBy, groupIds }) {
  const query = groupQuery
  const extractModel = 'Group'
  const getItems = get('payload.data.groups')

  return {
    type: FETCH_GROUPS,
    graphql: {
      query,
      variables: {
        allowedInPublic,
        first: pageSize,
        farmQuery,
        groupType,
        nearCoord,
        offset,
        order,
        search,
        sortBy,
        groupIds
      }
    },
    meta: {
      slug,
      extractModel,
      extractQueryResults: {
        getItems
      }
    }
  }
}

const groupQuery = `
query FetchGroups (
  $allowedInPublic: Boolean,
  $boundingBox: [PointInput],
  $first: Int,
  $farmQuery: JSON,
  $groupType: String,
  $nearCoord: PointInput,
  $offset: Int,
  $order: String,
  $search: String,
  $sortBy: String,
  $groupIds: [ID]
) {
  groups(
    allowedInPublic: $allowedInPublic,
    boundingBox: $boundingBox,
    first: $first,
    farmQuery: $farmQuery,
    groupType: $groupType,
    nearCoord: $nearCoord,
    offset: $offset,
    order: $order,
    search: $search,
    sortBy: $sortBy,
    groupIds: $groupIds
  ) {
    hasMore
    total
    items {
      accessibility
      memberCount
      description
      geoShape
      location
      locationObject {
        center {
          lat
          lng
        }
        city
        country
        fullText
        locality
        neighborhood
        region
      }
      id
      avatarUrl
      bannerUrl
      invitePath
      name
      purpose
      type
      settings {
        agreementsLastUpdatedAt
        allowGroupInvites
        askGroupToGroupJoinQuestions
        askJoinQuestions
        hideExtensionData
        publicMemberDirectory
        showSuggestedSkills
        showWelcomePage
      }
      slug
      groupTopics(first: 8) {
        items {
          id
          lastReadPostId
          topic {
            id
            name
          }
          postsTotal
        }
      }
      members(first: 5, sortBy: "last_active_at", order: "desc") {
        items {
          id
          avatarUrl
          lastActiveAt
          name
        }
      }
    }
  }
}
`

const getGroupsResults = makeGetQueryResults(FETCH_GROUPS)

export const getHasMoreGroups = createSelector(getGroupsResults, get('hasMore'))

export const getGroups = makeQueryResultsModelSelector(
  getGroupsResults,
  'Group'
)
