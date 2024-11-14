import { gql } from 'urql'

// TODO: URQL - analytics
// eventName: AnalyticsEvents.EVENT_RSVP,
// groupId: post.groups.map(g => g.id),

export default gql`
  mutation RespondToEventMutation ($id: ID, $response: String) {
    respondToEvent(id: $id, response: $response) {
      success
    }
  }
`
