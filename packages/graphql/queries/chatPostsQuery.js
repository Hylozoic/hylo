import { gql } from 'urql'
import { groupChatPostsQuerySetFragment } from '../fragments/chatPostsQuerySetFragment'

export default gql`
  query ChatPostsQuery(
    $cursor: ID,
    $filter: String,
    $first: Int,
    $order: String,
    $slug: String,
    $search: String,
    $sortBy: String,
    $topic: ID
  ) {
    group(slug: $slug) {
      id
      name
      slug
      ...GroupChatPostsQuerySetFragment
    }
  }
  ${groupChatPostsQuerySetFragment}
` 