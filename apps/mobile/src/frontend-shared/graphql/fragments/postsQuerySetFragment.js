import { gql } from 'urql'
import postFieldsFragment from 'frontend-shared/graphql/fragments/postFieldsFragment'

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

export const personPostsQuerySetFragment = gql`
  fragment PersonPostsQuerySetFragment on Person {
    ${postsQuerySetFieldsBlock}
  }
  ${postFieldsFragment}
`

export const postsQuerySetFragment = gql`
  fragment PostsQuerySetFragment on Query {
    ${postsQuerySetFieldsBlock}
  }
  ${postFieldsFragment}
`

export default postsQuerySetFragment
