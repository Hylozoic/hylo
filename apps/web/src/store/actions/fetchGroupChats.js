import { get } from 'lodash/fp'
import { createSelector } from 'reselect'
import { FETCH_GROUP_CHATS } from 'store/constants'
import { makeGetQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'

export default function fetchGroupChats ({ offset = 0, pageSize = 20, search }) {
  const query = groupChatsQuery
  const extractModel = 'GroupChat'
  const getItems = get('payload.data.groups')

  return {
    type: FETCH_GROUP_CHATS,
    graphql: {
      query,
      variables: {
        first: pageSize,
        groupType: 'groupchat', // Fixed groupType for group chats
        offset,
        search
      }
    },
    meta: {
      extractModel,
      extractQueryResults: {
        getItems
      }
    }
  }
}

const groupChatsQuery = `
query FetchGroupChats (
  $first: Int,
  $groupType: String,
  $offset: Int,
  $search: String
) {
  groups(
    first: $first,
    offset: $offset,
    search: $search,
    groupType: $groupType
  ) {
    hasMore
    total
    items {
      id
      avatarUrl
      name
      slug
      groupTopics(first: 1) {
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

const getGroupChatsResults = makeGetQueryResults(FETCH_GROUP_CHATS)

export const getHasMoreGroupChats = createSelector(getGroupChatsResults, get('hasMore'))

export const getGroupChats = makeQueryResultsModelSelector(
  getGroupChatsResults,
  'Group',
  wrapGroupChatInWidget
)

function wrapGroupChatInWidget (groupChat, index) {
  return {
    type: 'groupchat',
    id: groupChat.id,
    parentId: null,
    order: index + 1,
    viewGroup: groupChat
  }
}
