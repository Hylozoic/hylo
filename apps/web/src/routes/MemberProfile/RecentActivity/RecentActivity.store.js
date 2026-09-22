import { createSelector as ormCreateSelector } from 'redux-orm'
import { compact } from 'lodash/fp'
import orm from 'store/models'
import postsQueryFragment from '@graphql/fragments/postsQueryFragment'
import presentPost from 'store/presenters/presentPost'
import presentComment from 'store/presenters/presentComment'

const profilePostsFragment = postsQueryFragment.replace('offset: $offset', 'offset: $postsOffset')

export const FETCH_RECENT_ACTIVITY = 'FETCH_RECENT_ACTIVITY'

const recentActivityQuery =
`query RecentActivity (
  $activePostsOnly: Boolean,
  $afterTime: Date,
  $announcementsOnly: Boolean,
  $beforeTime: Date,
  $boundingBox: [PointInput],
  $collectionToFilterOut: ID,
  $context: String,
  $createdBy: [ID],
  $cursor: ID,
  $filter: String,
  $first: Int,
  $forCollection: ID,
  $groupSlugs: [String],
  $id: ID,
  $interactedWithBy: [ID],
  $isFulfilled: Boolean,
  $mentionsOf: [ID],
  $commentsOffset: Int,
  $postsOffset: Int,
  $order: String,
  $savedBy: [ID],
  $search: String,
  $sortBy: String,
  $topic: ID,
  $topics: [ID],
  $types: [String]
) {
  person (id: $id) {
    id
    comments (first: $first, offset: $commentsOffset, order: $order) {
      hasMore
      items {
        id
        text
        creator {
          id
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
    ${profilePostsFragment}
  }
}`

export function fetchRecentActivity (id, first = 20, offsets = {}, query = recentActivityQuery) {
  const postsOffset = typeof offsets === 'number' ? offsets : (offsets?.postsOffset || 0)
  const commentsOffset = typeof offsets === 'number' ? offsets : (offsets?.commentsOffset || 0)
  return {
    type: FETCH_RECENT_ACTIVITY,
    graphql: {
      query,
      variables: {
        id,
        first,
        postsOffset,
        commentsOffset,
        order: 'desc',
        sortBy: 'created'
      }
    },
    meta: { extractModel: 'Person' }
  }
}

// Deliberately preserves object references
// Intersperses posts and comments
export function indexActivityItems (comments, posts) {
  // descending order
  return comments.concat(posts)
    .sort((a, b) => {
      const aDate = new Date(a.createdAt)
      const bDate = new Date(b.createdAt)
      return aDate < bDate ? 1 : aDate > bDate ? -1 : 0
    })
}

export const getRecentActivity = ormCreateSelector(
  orm,
  (_, { routeParams }) => routeParams,
  ({ Person }, { personId, slug }) => {
    if (!Person.idExists(personId)) return
    const person = Person.withId(personId)
    const comments = compact(person.comments.toModelArray().map(comment =>
      presentComment(comment, slug)))
    const posts = compact(person.posts.toModelArray().map(post =>
      presentPost(post)))
    return indexActivityItems(comments, posts)
  })
