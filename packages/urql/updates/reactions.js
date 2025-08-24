import { gql } from 'urql'
import meQuery from '@hylo/graphql/queries/meQuery'

/*

reactOn and deleteReaction mutation updaters specifically for Comment and ChildComments

The reasons these cache updaters are necessary are due to the return type of reactOn and deleteReaction always being a Post
which forces the returned selection set to always be a Post resulting in a cache update for the entire Post in the case
of a Comment or ChildComment reaction.

Without these updaters the returned results from a reactOn or reactionDelete for a Comment results in the entire Post being
re-queries, in addition to the Stream queries which may contain this Post. This custom updater probably could be avoided
entirely if we returned a Reaction type from these two methods.

*/

const commentReactionsFragment = gql`
  fragment _ on Comment {
    commentReactionsTotal
    commentReactions {
      id
      emojiFull
      user {
        id
        name
        avatarUrl
      }
    }
  }
`

export function reactOn (_results, args, cache, info) {
  const { entityType, entityId, emojiFull } = args.data

  if (entityType !== 'comment') return

  const currentUser = cache.readQuery({ query: meQuery })?.me
  const commentData = cache.readFragment(commentReactionsFragment, { id: entityId })
  const myReaction = {
    __typename: 'Reaction',
    id: 'new' + Math.random().toString(),
    emojiFull
  }
  const commentReaction = {
    ...myReaction,
    user: {
      __typename: 'Person',
      id: currentUser.id,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl
    }
  }

  cache.writeFragment(commentReactionsFragment, {
    id: entityId,
    commentReactionsTotal: (commentData?.commentReactionsTotal || 0) + 1,
    commentReactions: [...(commentData?.commentReactions || []), commentReaction]
  })
}

export function deleteReaction (_results, args, cache, info) {
  const { entityType, entityId, emojiFull } = args.data

  if (entityType !== 'comment') return
  const currentUser = cache.readQuery({ query: meQuery })?.me
  const commentData = cache.readFragment(commentReactionsFragment, { id: entityId })

  if (!commentData) return
  cache.writeFragment(commentReactionsFragment, {
    id: entityId,
    commentReactionsTotal: Math.max(0, commentData.commentReactionsTotal - 1),
    commentReactions: commentData.commentReactions.filter(
      r => !(r.emojiFull === emojiFull && r.user.id === currentUser.id)
    )
  })
}
