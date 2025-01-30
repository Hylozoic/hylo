import { gql } from 'urql'
import meQuery from 'frontend-shared/graphql/queries/meQuery'

export default (_results, args, cache, info) => {
  const { entityType, entityId, emojiFull } = args.data
  const currentUser = cache.readQuery({ query: meQuery })?.me

  if (entityType === 'comment') {
    const commentData = cache.readFragment(
      gql`
        fragment _ on Comment {
          commentReactionsTotal
          myReactions {
            id
            emojiFull
          }
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
      `,
      { id: entityId }
    )

    if (commentData) {
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

      cache.writeFragment(
        gql`
          fragment _ on Comment {
            id
            commentReactionsTotal
            myReactions {
              id
              emojiFull
            }
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
        `,
        {
          id: entityId,
          commentReactionsTotal: (commentData.commentReactionsTotal || 0) + 1,
          myReactions: [...(commentData.myReactions || []), myReaction],
          commentReactions: [...(commentData.commentReactions || []), commentReaction]
        }
      )
    }
  }
}

// NOTE: Post update code, works but is not necessary. Keeping for reference.
// export default {
//   Mutation: {
//     reactOn: (_results, args, cache, info) => {
//       const { entityType, entityId, emojiFull } = args.data
//       const currentUser = cache.readQuery({ query: meQuery })?.me

//       if (entityType === 'post') {
//         const postData = cache.readFragment(
//           gql`
//             fragment _ on Post {
//               peopleReactedTotal
//               myReactions {
//                 id
//                 emojiFull
//               }
//               postReactions {
//                 id
//                 emojiFull
//                 user {
//                   id
//                   name
//                   avatarUrl
//                 }
//               }
//             }
//           `,
//           { id: entityId }
//         )

//         if (postData) {
//           const myReaction = {
//             __typename: 'Reaction',
//             id: 'new' + Math.random().toString(),
//             emojiFull
//           }
//           const postReaction = {
//             ...myReaction,
//             user: {
//               __typename: 'Person',
//               id: currentUser.id,
//               name: currentUser.name,
//               avatarUrl: currentUser.avatarUrl
//             }
//           }
//           console.log('!!! postReaction', postReaction)

//           cache.writeFragment(
//             gql`
//               fragment _ on Post {
//                 id
//                 peopleReactedTotal
//                 myReactions {
//                   id
//                   emojiFull
//                 }
//                 postReactions {
//                   id
//                   emojiFull
//                   user {
//                     id
//                     name
//                     avatarUrl
//                   }
//                 }
//               }
//             `,
//             {
//               id: entityId,
//               postReactionsTotal: (postData.postReactionsTotal || 0) + 1,
//               myReactions: [...(postData.myReactions || []), myReaction],
//               postReactions: [...(postData.postReactions || []), postReaction]
//             }
//           )
//         }
//       }
//     }
//   }
// }