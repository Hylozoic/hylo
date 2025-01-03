import { gql } from 'urql'
import postFieldsFragment from 'graphql/fragments/postFieldsFragment'

const postsQuerySetFieldsBlock = `
  posts(
    activePostsOnly: $activePostsOnly,
    afterTime: $afterTime,
    announcementsOnly: $announcementsOnly,
    beforeTime: $beforeTime,
    boundingBox: $boundingBox,
    collectionToFilterOut: $collectionToFilterOut,
    createdBy: $createdBy,
    filter: $filter,
    first: $first,
    forCollection: $forCollection,
    groupSlugs: $groupSlugs,
    isFulfilled: $isFulfilled,
    interactedWithBy: $interactedWithBy,
    mentionsOf: $mentionsOf,
    offset: $offset,
    context: $context,
    order: $order,
    sortBy: $sortBy,
    search: $search,
    topic: $topic,
    topics: $topics,
    types: $types
  ) {
    hasMore
    total
    items {
      ...PostFieldsFragment
    }
  }
`

export const personPostsQueryFragment = gql`
  fragment PersonPostsQueryFragment on Person {
    ${postsQuerySetFieldsBlock}
  }
  ${postFieldsFragment}
`

export const postsQueryFragment = gql`
  fragment PostsQueryFragment on Query {
    ${postsQuerySetFieldsBlock}
  }
  ${postFieldsFragment}
`

export default postsQueryFragment
