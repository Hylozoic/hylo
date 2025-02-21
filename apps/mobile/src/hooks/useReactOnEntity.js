import { gql, useMutation } from 'urql'
import { AnalyticsEvents } from '@hylo/shared'
import mixpanel from 'services/mixpanel'

const REACT_ON_MUTATION = gql` 
  mutation reactOn($entityId: ID, $data: ReactionInput) {
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

const DELETE_POST_REACTION_MUTATION = gql`
  mutation deletePostReaction($entityId: ID, $data: ReactionInput) {
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

const DELETE_COMMENT_REACTION_MUTATION = gql`
  mutation deleteCommentReaction($entityId: ID, $data: ReactionInput) {
    deleteReaction(entityId: $entityId, data: $data) {
      id
    }
  }
`

export default function useReactOnEntity () {
  const [, reactOn] = useMutation(REACT_ON_MUTATION)
  const [, deletePostReaction] = useMutation(DELETE_POST_REACTION_MUTATION)
  const [, deleteCommentReaction] = useMutation(DELETE_COMMENT_REACTION_MUTATION)
  const reactOnEntity = async (entityType, entityId, emojiFull) => {
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
