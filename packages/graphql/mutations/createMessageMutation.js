import messageThreadFieldsFragment from '../fragments/messageThreadFieldsFragment'
import { gql } from 'urql'

// TODO: URQL - analytics: AnalyticsEvents.DIRECT_MESSAGE_SENT
// TODO: URQL - Look into createMessage updater which currently simply invalidates the whole thread.

// This mutation doesn't require an updater because it fragment matches for MessageThreadFieldsFragment
// this are a couple things to think about in this one, but it is a good example of a couple things
// we can consider about writing our mutations in a way that don't necessitate writing updaters...

export default gql` 
  mutation CreateMessageMutation (
    $messageThreadId: String,
    $text: String
    $createdAt: Date
    # $firstMessages: Int = 1
  ) {
    createMessage(data: {
      messageThreadId: $messageThreadId,
      text: $text
      createdAt: $createdAt
    }) {
      createdAt
      id
      text
      creator {
        id
        name
        avatarUrl
      }
    }
  }
`
