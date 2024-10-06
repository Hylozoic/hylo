import { gql, useMutation } from 'urql'


// TODO: Re-integrate analytics reporting:
// analytics: {
//   commentId,
//   eventName: entityType === 'post' ? AnalyticsEvents.POST_REACTION : AnalyticsEvents.COMMENT_REACTION,
//   emoji: emojiFull,
//   groupId: groupIds,
//   postId,
//   type: entityType === 'post' ? 'post' : 'comment'
// }

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
  mutation deleteReaction($entityId: ID, $data: ReactionInput) {
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
  mutation deleteReaction($entityId: ID, $data: ReactionInput) {
    deleteReaction(entityId: $entityId, data: $data) {
      id
    }
  }
`

// postReactions {
//   id
//   emojiFull
//   user {
//     id
//     name
//     avatarUrl
//   }
// }
// myReactions {
//   id
//   emojiFull
// }
// peopleReactedTotal
// comments {
//   items {
//     id
//     childComments {
//       items {
//         id
//         commentReactionsTotal
//         commentReactions {
//           id
//           emojiFull
//           user {
//             id
//             name
//             avatarUrl
//           }
//         }
//         myReactions {
//           id
//           emojiFull
//         }
//       }
//     }
//     commentReactionsTotal
//     commentReactions {
//       id
//       emojiFull
//       user {
//         id
//         name
//         avatarUrl
//       }
//     }
//     myReactions {
//       id
//       emojiFull
//     }
//   }
// }

export default function useReactOnEntity () {
  const [reactOnResult, reactOn] = useMutation(REACT_ON_MUTATION)
  const [deleteReactionResult, deletePostReaction] = useMutation(DELETE_POST_REACTION_MUTATION)
  const [deleteCommentReactionResult, deleteCommentReaction] = useMutation(DELETE_COMMENT_REACTION_MUTATION)
  const reactOnEntity = async (entityType, entityId, emojiFull) =>
    reactOn({ entityId, data: { emojiFull, entityType, entityId } })

  const deleteReactionFromEntity = async (entityType, entityId, emojiFull) => entityType === 'post'
    ? deletePostReaction({ entityId, data: { emojiFull, entityType, entityId } })
    : deleteCommentReaction({ entityId, data: { emojiFull, entityType, entityId } })

  return { reactOnEntity, deleteReactionFromEntity }
}
