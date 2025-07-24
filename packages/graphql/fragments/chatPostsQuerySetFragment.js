import { gql } from 'urql'
import postFieldsFragment from '../fragments/postFieldsFragment'

const chatPostsQuerySetFieldsBlock = `
  posts(
    cursor: $cursor,
    filter: $filter,
    first: $first,
    order: $order,
    search: $search,
    sortBy: $sortBy,
    topic: $topic
  ) {
    hasMore
    total
    items {
      ...PostFieldsFragment
    }
  }
`

export const groupChatPostsQuerySetFragment = gql`
  fragment GroupChatPostsQuerySetFragment on Group {
    ${chatPostsQuerySetFieldsBlock}
  }
  ${postFieldsFragment}
`

export default groupChatPostsQuerySetFragment 