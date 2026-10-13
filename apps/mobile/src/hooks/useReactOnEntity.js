import { gql, useMutation } from 'urql'
import { AnalyticsEvents } from '@hylo/shared'
import { trackWithConsent } from 'services/mixpanel'
import useCurrentUser from '@hylo/hooks/useCurrentUser'

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

export default function useReactOnEntity (entity, entityType, group, onReacted) {
  const [, reactOn] = useMutation(reactOnMutation)
  const [, deletePostReaction] = useMutation(deletePostReactionMutation)
  const [, deleteCommentReaction] = useMutation(deleteCommentReactionMutation)
  const [{ currentUser }] = useCurrentUser()
  const reactOnEntity = async (entityType, entityId, emojiFull) => {
    reactOn({ entityId, data: { emojiFull, entityType, entityId } })
    trackWithConsent(
      entityType === 'post' ? AnalyticsEvents.POST_REACTION : AnalyticsEvents.COMMENT_REACTION, {
        commentId: entityType === 'comment' && entityId,
        emoji: emojiFull,
        postId: entityType === 'post' && entityId,
        type: entityType === 'post' ? 'post' : 'comment'
      }, currentUser, !currentUser
    )
  }

  const deleteReactionFromEntity = async (entityType, entityId, emojiFull) => entityType === 'post'
    ? deletePostReaction({ entityId, data: { emojiFull, entityType, entityId } })
    : deleteCommentReaction({ entityId, data: { emojiFull, entityType, entityId } })

  return { reactOnEntity, deleteReactionFromEntity }
}
