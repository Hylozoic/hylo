import chatPostFieldsFragment from '@graphql/fragments/chatPostFieldsFragment'
import { FETCH_CHAT_ROOM_INIT } from 'store/constants'

// Combined GraphQL query that fetches topicFollow AND posts in a single network request
// Uses topicName parameter (new backend feature) to avoid type mismatch
// This eliminates the waterfall delay (~300-500ms) from sequential loading
export default function fetchChatRoomInit ({
  groupId,
  groupSlug,
  topicName,
  lastReadPostId = null,
  initialPostsToLoad = 12,
  search = ''
}) {
  // Calculate cursor based on lastReadPostId if available
  const pastCursor = lastReadPostId ? parseInt(lastReadPostId) + 1 : undefined
  const futureCursor = lastReadPostId ? parseInt(lastReadPostId) : undefined

  return {
    type: FETCH_CHAT_ROOM_INIT,
    graphql: {
      query: CHAT_ROOM_INIT_QUERY,
      variables: {
        groupId,
        groupSlug,
        topicName,
        pastCursor,
        futureCursor,
        pastFirst: initialPostsToLoad,
        futureFirst: 100, // Load up to 100 new messages
        search
      }
    },
    meta: {
      groupSlug,
      topicName,
      extractModel: 'Group',
      extractQueryResults: {
        getItems: response => response.payload?.data?.group?.postsPast
      }
    }
  }
}

const CHAT_ROOM_INIT_QUERY = `
  query ChatRoomInitQuery(
    $groupId: ID,
    $groupSlug: String,
    $topicName: String,
    $pastCursor: ID,
    $futureCursor: ID,
    $pastFirst: Int,
    $futureFirst: Int,
    $search: String
  ) {
    topicFollow(groupId: $groupId, topicName: $topicName) {
      id
      lastReadPostId
      newPostCount
      settings {
        notifications
      }
      group {
        id
      }
      topic {
        id
        name
      }
    }

    group(slug: $groupSlug, updateLastViewed: true) {
      id
      slug
      name
      avatarUrl
      bannerUrl

      postsPast: posts(
        cursor: $pastCursor,
        filter: "chat",
        first: $pastFirst,
        order: "desc",
        sortBy: "id",
        topicName: $topicName,
        search: $search
      ) {
        hasMore
        total
        items {
          ${chatPostFieldsFragment}
        }
      }

      postsFuture: posts(
        cursor: $futureCursor,
        filter: "chat",
        first: $futureFirst,
        order: "asc",
        sortBy: "id",
        topicName: $topicName,
        search: $search
      ) {
        hasMore
        total
        items {
          ${chatPostFieldsFragment}
        }
      }
    }
  }
`
