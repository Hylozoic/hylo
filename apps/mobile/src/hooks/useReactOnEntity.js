import { gql, useMutation } from 'urql'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'

const reactOnMutation = gql` 
  mutation ReactOnMutation($entityId: ID, $data: ReactionInput) {
    reactOn(entityId: $entityId, data: $data) {
      id
      postReactions {
        id
        emojiFull
        user {
          id
          name
          avatarUrl
        }
      }
      myReactions {
        id
        emojiFull
      }
      peopleReactedTotal
    }
  }
`

const deletePostReactionMutation = gql`
  mutation DeletePostReactionMutation($entityId: ID, $data: ReactionInput) {
    deleteReaction(entityId: $entityId, data: $data) {
      id
      postReactions {
        id
        emojiFull
        user {
          id
          name
          avatarUrl
        }
      }
      myReactions {
        id
        emojiFull
      }
      peopleReactedTotal
    }
  }
`

const deleteCommentReactionMutation = gql`
  mutation DeleteCommentReactionMutation($entityId: ID, $data: ReactionInput) {
    deleteReaction(entityId: $entityId, data: $data) {
      id
    }
  }
`

export default function useReactOnEntity () {
  const [, reactOn] = useMutation(reactOnMutation)
  const [, deletePostReaction] = useMutation(deletePostReactionMutation)
  const [, deleteCommentReaction] = useMutation(deleteCommentReactionMutation)
  const reactOnEntity = async (entityType, entityId, emojiFull) => {
    console.log('reactOnEntity workskdk', entityType, entityId, emojiFull)
    reactOn({ entityId, data: { emojiFull, entityType, entityId } })
    mixpanel.track(
      entityType === 'post' ? AnalyticsEvents.POST_REACTION : AnalyticsEvents.COMMENT_REACTION, {
        commentId: entityType === 'comment' && entityId,
        emoji: emojiFull,
        postId: entityType === 'post' && entityId,
        type: entityType === 'post' ? 'post' : 'comment'
      }
    )
  }

  const deleteReactionFromEntity = async (entityType, entityId, emojiFull) => entityType === 'post'
    ? deletePostReaction({ entityId, data: { emojiFull, entityType, entityId } })
    : deleteCommentReaction({ entityId, data: { emojiFull, entityType, entityId } })

  return { reactOnEntity, deleteReactionFromEntity }
}
