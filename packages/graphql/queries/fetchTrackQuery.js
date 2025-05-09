import { gql } from 'urql'
import trackFieldsFragment from '../fragments/trackFieldsFragment'
import { postWithCommentsAndCompletionResponsesFragment } from '../fragments/postFieldsFragment'

export default gql`
  query FetchTrackQuery($id: ID) {
    track(id: $id) {
      ...TrackFields
      posts {
        items {
          ...PostWithCommentsAndCompletionResponsesFragment
        }
      }
    }
  }
  ${trackFieldsFragment}
  ${postWithCommentsAndCompletionResponsesFragment}
`
