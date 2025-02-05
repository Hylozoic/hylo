import { gql } from 'urql'

// TODO: URQL - analytics
// analytics: {
//   eventName: AnalyticsEvents.EVENT_RSVP,
//   groupId: post.groups.map(g => g.id),
// }
// analytics: {
//   eventName: AnalyticsEvents.EVENT_RSVP,
//   groupId: post.groups.map(g => g.id),
//   response
// }

export default gql`
  mutation RespondToEventMutation ($id: ID, $response: String) {
    respondToEvent(id: $id, response: $response) {
      success
    }
  }
`
