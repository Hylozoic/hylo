import { gql } from 'urql'
import { personPostsQuerySetFragment } from '../fragments/postsQuerySetFragment'
import { postFieldsFragment } from '../fragments/postFieldsFragment'

export default gql`
  query RecentActivityQuery (
    $first: Int,
    $id: ID,
    $order: String,
    $activePostsOnly: Boolean,
    $afterTime: Date,
    $announcementsOnly: Boolean,
    $beforeTime: Date,
    $boundingBox: [PointInput],
    $collectionToFilterOut: ID,
    $context: String,
    $createdBy: [ID],
    $filter: String,
    $forCollection: ID,
    $groupSlugs: [String],
    $interactedWithBy: [ID],
    $isFulfilled: Boolean,
    $mentionsOf: [ID],
    $offset: Int,
    $savedBy: [ID],
    $search: String,
    $sortBy: String,
    $topic: ID,
    $topics: [ID],
    $types: [String]
  ) {
    person (id: $id) {
      id
      comments (first: $first, order: $order) {
        hasMore
        total
        items {
          id
          text
          creator {
            id
            name
            avatarUrl
          }
          post {
            id
            title
          }
          attachments {
            type
            url
            position
            id
          }
          createdAt
        }
      }
      reactions (first: $first, order: $order) {
        hasMore
        total
        items {
          id
          createdAt
          emojiBase
          emojiFull
          emojiLabel
          post {
            ...PostFieldsFragment
          }
        }
      }
      ...PersonPostsQuerySetFragment
    }
  }
  ${personPostsQuerySetFragment}
  ${postFieldsFragment}
`
