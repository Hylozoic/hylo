import { gql } from 'urql'

export default gql`
  query TracksQuery(
    $id: ID,
    $first: Int = 20,
    $offset: Int = 0,
    $sortBy: String = "published_at",
    $order: String = "desc",
    $enrolled: Boolean,
    $autocomplete: String
  ) {
    group(id: $id) {
      id
      tracks(
        autocomplete: $autocomplete,
        enrolled: $enrolled,
        first: $first,
        offset: $offset,
        sortBy: $sortBy,
        order: $order
      ) {
        items {
          id
          bannerUrl
          actionsName
          description
          completionBadgeEmoji
          completionBadgeName
          completionMessage
          didComplete
          isEnrolled
          name
          numActions
          numPeopleCompleted
          numPeopleEnrolled
          publishedAt
          userSettings
          welcomeMessage
        }
      }
    }
  }
`
