import { gql, useSubscription } from 'urql'

const UNIFIED_SUBSCRIPTION = gql`
  subscription UnifiedSubscription {
    allUpdates {
      __typename
      ... on Notification {
        id
        createdAt
        activity {
          id
          action
          actor {
            id
            name
            avatarUrl
          }
          comment {
            id
            text
          }
          post {
            id
            title
            details
            groups {
              id
              slug
            }
          }
          group {
            id
            name
            slug
          }
          track {
            id
            name
          }
          meta {
            reasons
          }
          unread
        }
      }
      ... on Group {
        id
        name
        slug
        avatarUrl
        memberCount
        description
      }
      ... on GroupMembershipUpdate {
        action
        role
        group {
          id
          name
          slug
          avatarUrl
          memberCount
        }
        member {
          id
          name
          avatarUrl
        }
      }
      ... on GroupRelationshipUpdate {
        action
        parentGroup {
          id
          name
          slug
          avatarUrl
        }
        childGroup {
          id
          name
          slug
          avatarUrl
        }
        relationship {
          id
          createdAt
        }
      }
      ... on Post {
        id
        updatedAt
        title
        details
        type
        commentsTotal
        peopleReactedTotal
        reactionsSummary
        postReactions {
          id
          emojiFull
          emojiBase
          user {
            id
            name
          }
        }
        fulfilledAt
        completedAt
      }
      ... on Comment {
        id
        text
        createdAt
        creator {
          id
          name
          avatarUrl
        }
        # This will be a Message if makeModelsType is set
      }
    }
  }
`

/**
 * Custom hook that subscribes to the unified subscription stream
 * and handles all update types in a single connection.
 *
 * This replaces the need for multiple individual subscriptions,
 * which helps with Android's 4 SSE connection limit.
 */
export default function useUnifiedSubscription (options = {}) {
  const { pause = false } = options
  const [result] = useSubscription({
    query: UNIFIED_SUBSCRIPTION,
    pause
  })

  // Handle subscription errors gracefully
  if (result.error) {
    console.warn('Unified subscription error:', result.error)

    // In development, log more details about the error
    if (process.env.NODE_ENV === 'development') {
      console.error('📱 Unified subscription failed:', {
        message: result.error.message,
        graphQLErrors: result.error.graphQLErrors,
        networkError: result.error.networkError
      })
    }
  }

  // The subscription handling is done automatically by urql's cache system
  // The cache updates are handled by the existing update functions in packages/urql/updates
  // since they key off the typename and payload structure

  return result
}