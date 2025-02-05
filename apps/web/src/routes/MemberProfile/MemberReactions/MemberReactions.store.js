import { createSelector as ormCreateSelector } from 'redux-orm'
import { compact } from 'lodash/fp'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import postFieldsFragment from '@graphql/fragments/postFieldsFragment'
import { FETCH_MEMBER_REACTIONS } from '../MemberProfile.store'

export function fetchMemberReactions (id, order = 'desc', limit = 20, providedQuery) {
  const query = providedQuery ||
  `query MemberReactions ($id: ID, $order: String, $limit: Int) {
    person (id: $id) {
      id
      reactions (first: $limit, order: $order) {
        items {
          id
          userId
          post {
            ${postFieldsFragment(false)}
          }
          createdAt
        }
      }
    }
  }`
  return {
    type: FETCH_MEMBER_REACTIONS,
    graphql: {
      query,
      variables: { id, limit, order }
    },
    meta: { extractModel: 'Person' }
  }
}

export const getMemberReactions = ormCreateSelector(
  orm,
  (_, { routeParams }) => routeParams,
  ({ Reaction }, { personId }) => {
    const reactions = Reaction.filter(r => String(r.userId) === String(personId)).toModelArray()
    if (!reactions) return []
    return compact(reactions.map(({ post }) => {
      if (!post) return null
      return presentPost(post)
    }))
  }
)
