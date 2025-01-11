import { postCommentsQuery, childCommentsQuery } from "components/Comments/Comments"
import { gql } from 'urql'

// export default function createComment (result, args, cache) {
//   if (args?.data?.parentCommentId) {
//     cache.invalidate({ __typename: 'Comment', id: args?.data?.parentCommentId })
//   } else {
//     const postKey = cache.keyOfEntity({ __typename: 'Post', id: args.data.postId })
//     const postCommentsFields = cache.inspectFields(postKey).filter(fi => fi.fieldName === 'comments')

//     postCommentsFields.forEach(({ fieldKey }) => {
//       cache.invalidate(postKey, fieldKey)
//     })
//   }
// }

export default function createCommentUpdateQueries (result, args, cache) {
  if (args.data.parentCommentId) {
    cache.updateQuery({
      query: postCommentsQuery,
      variables: {
        postId: args.data.postId
      }
    }, data => {
      console.log('!!!!!!!! data.post', data.post)
      const comments = data.post.comments.items.map(comment => {
        if (comment.id === args.data.parentCommentId) {
          return {
            ...comment,
            '`childComments({"first":2,"order":"desc"})`': {
              ...comment.childComments,
              items: [
                ...comment.childComments.items,
                result.createComment
              ]
            }
          }
        } else {
          return comment
        }
      })
      // delete data.post.comments
      const output = {
        post: {
          ...data.post,
          comments
        }
      }
      console.log('!@!!! output', output)
      return output
    })
  } else {
    cache.updateQuery({
      query: postCommentsQuery,
      variables: {
        postId: args.data.postId
      }
    }, data => {
      return {
        post: {
          ...data.post,
          comments: {
            ...data.post.comments,
            items: [
              ...data.post.comments.items.map(comment => ({
                ...comment,
                'childComments({"first":2,"order":"desc"})': comment.childComments
              })),
              {
                ...result.createComment,
                text: 'blah',
                // parentComment: null,
                // myReactions: [],
                // commentReactions: [],
                'childComments({"first":2,"order":"desc"})': {
                    hasMore: false,
                    items: [],
                    total: 0
                }
              }
            ]
          }
        }
      }
    })
  }
}

// TODO: URQL - The below kept around for reference and later exploration, delete later

// const createComment = (result, args, cache) => {
//   if (args?.data?.parentCommentId) {
//     const parentCommentKey = cache.keyOfEntity({
//       __typename: 'Comment',
//       id: args.data.parentCommentId,
//     })

//     if (parentCommentKey) {
//       const childCommentsField = cache
//         .inspectFields(parentCommentKey)
//         .find((field) => field.fieldName === 'childComments')

//       if (childCommentsField) {
//         const existingChildComments = cache.resolve(parentCommentKey, childCommentsField.fieldKey) || {}
//         const items = cache.resolve(existingChildComments, 'items') || []
//         const newComment = {
//           ...result.createComment,
//           myReactions: [],
//           commentReactions: [],
//         }

//         cache.link(parentCommentKey, childCommentsField.fieldKey, {
//           ...existingChildComments,
//           items: [...items, newComment],
//         })
//       }
//     }
//   } else {
//     // Handle top-level comment case
//     const postKey = cache.keyOfEntity({
//       __typename: 'Post',
//       id: args.data.postId,
//     })

//     if (postKey) {
//       const commentsField = cache
//         .inspectFields(postKey)
//         .find((field) => field.fieldName === 'comments')

//       if (commentsField) {
//         const existingComments = cache.resolve(postKey, commentsField.fieldKey) || {}
//         const items = cache.resolve(existingComments, 'items') || []
//         const newComment = {
//           ...result.createComment,
//           myReactions: [],
//           commentReactions: [],
//         }

//         cache.link(postKey, commentsField.fieldKey, {
//           ...existingComments,
//           items: [...items, newComment],
//         })
//       }
//     }
//   }
// }

// export const createCommentLink = (result, args, cache) => {
//   const postKey = cache.keyOfEntity({ __typename: 'Post', id: args.data.postId })

//   // For child comment
//   if (args?.data?.parentCommentId) {
//     const parentCommentKey = cache.keyOfEntity({ __typename: 'Comment', id: args.data.parentCommentId })
//     const childCommentsFields = cache.inspectFields(parentCommentKey).filter(fi => fi.fieldName === 'childComments')

//     childCommentsFields.forEach(({ fieldKey: childCommentsKey }) => {
//       const childComments = cache.resolve(parentCommentKey, childCommentsKey)
//       const items = cache.resolve(childComments, 'items') || []
//       const hasMore = cache.resolve(childComments, 'hasMore')
//       const total = cache.resolve(childComments, 'total')

//       // Update `comments` with the new comment
//       cache.link(parentCommentKey, childCommentsKey, {
//         items: [
//           ...items,
//           {
//             ...result.createComment,
//             myReactions: [],
//             commentReactions: [],
//           }
//         ],
//         hasMore,
//         total
//       })
//     })
//   // Regular comment
//   } else {
//     const postCommentsFields = cache.inspectFields(postKey).filter(fi => fi.fieldName === 'comments')

//     postCommentsFields.forEach(({ fieldKey }) => {
//       // Resolve existing `comments` field data
//       const existingComments = cache.resolve(postKey, fieldKey) || {}
//       const items = cache.resolve(existingComments, 'items') || []

//       // Update `comments` with the new comment
//       cache.link(postKey, fieldKey, {
//         ...existingComments,
//         items: [
//           ...items,
//           {
//             ...result.createComment,
//             myReactions: [],
//             commentReactions: [],
//             childComments: { items: [], hasMore: false }
//           }
//         ]
//       })
//     })
//   }
// }

// export default function createComment (result, args, cache) {
//   if (args.data.parentCommentId) {
//     // // cache.invalidate({ __typename: 'Comment', id: args?.data?.parentCommentId })
//     const { createComment: newComment } = result
//     const parentCommentKey = cache.keyOfEntity({ __typename: 'Comment', id: args.data.parentCommentId })
//     cache.inspectFields(parentCommentKey).filter(field => field.fieldName === 'childComments').forEach(childCommentsField => {
//       // console.log("cache.resolve(parentCommentKey, childCommentsField.fieldKey, 'items')", cache.resolve(cache.resolve(parentCommentKey, childCommentsField.fieldKey), 'items'))
//       const childComments = cache.resolve(parentCommentKey, childCommentsField.fieldKey)
//       const newChildCommentsContent = {
//         items: [
//           ...cache.resolve(childComments, 'items'),
//           newComment
//         ],
//         hasMore: cache.resolve(childComments, 'hasMore'),
//         total: cache.resolve(childComments, 'total')
//       }
//       console.log('!!! should link: ', childCommentsField.fieldKey, 'to: ', newChildCommentsContent)
//       cache.link(parentCommentKey, childCommentsField.fieldKey, newChildCommentsContent)
//     })
//     // NOTE: This won't work as-is because the childComments in PostDetails come from the postCommentsQuery and only from childCommentsQuery
//     // if we have clicked "Show more" on a post for subcomments. So, the childCommentsQuery will not be in the cache unless we've done that,
//     // and in those cases the cursor arg which was provided is unknown to use here (though we could iterate over cache entries to find it)
//     // const data = cache.updateQuery({ query: childCommentsQuery, variables: { commentId: args.data.parentCommentId } }, data => {
//     //   console.log('!!!! data', data)
//     //   const { comment } = data
//     //   const { createComment: newComment } = result
//     //   return {
//     //     comment: {
//     //       ...comment,
//     //       childComments: {
//     //         ...comment.childComments,
//     //         items: [
//     //           ...comment.childComments.items,
//     //           newComment
//     //         ]
//     //       }
//     //     }
//     //   }
//     // })
//   } else {
//     const data = cache.updateQuery({ query: postCommentsQuery, variables: { postId: args.data.postId } }, data => {
//       const { post } = data
//       const { createComment: newComment } = result
//       delete newComment.childComments
//       newComment['`childComments({"first":2,"order":"desc"})`'] = {
//         __typename: 'CommentQuerySet',
//         hasMore: false,
//         total: 0,
//         items: []
//       }
//       console.log('!!!! post.comments.items[0]:', post.comments.items[0])

//       return {
//         post: {
//           ...post,
//           comments: {
//             ...post.comments,
//             items: [
//               ...post.comments.items.map(comment => ({
//                 ...comment,
//                 '`childComments({"first":2,"order":"desc"})`': comment.childComments
//               })),
//               newComment
//             ]
//           }
//         }
//       }
//     })
//   }
//   // if (args?.data?.parentCommentId) {
//   //   cache.invalidate({ __typename: 'Comment', id: args?.data?.parentCommentId })
//   // } else {
//   //   const postKey = cache.keyOfEntity({ __typename: 'Post', id: args.data.postId })
//   //   const postCommentsFields = cache.inspectFields(postKey).filter(fi => fi.fieldName === 'comments')

//   //   postCommentsFields.forEach(({ fieldKey }) => {
//   //     cache.invalidate(postKey, fieldKey)
//   //   })
//   // }
// }