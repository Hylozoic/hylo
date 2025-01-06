import { gql } from 'urql'

export default function createComment (result, args, cache) {
  if (args?.data?.parentCommentId) {
    cache.invalidate({ __typename: 'Comment', id: args?.data?.parentCommentId })
  } else {
    const postKey = cache.keyOfEntity({ __typename: 'Post', id: args.data.postId })
    const postCommentsFields = cache.inspectFields(postKey).filter(fi => fi.fieldName === 'comments')

    postCommentsFields.forEach(({ fieldKey }) => {
      cache.invalidate(postKey, fieldKey)
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

// export function createCommentUpdateQueries (result, args, cache) {
//   if (args.data.parentCommentId) {
//     cache.updateQuery({
//       query: postCommentsQuery,
//       variables: {
//         postId: args.data.postId
//       }
//     }, data => {
//       console.log('!!!!!!!! data.post', data.post)
//       const comments = data.post.comments.items.map(comment => {
//         if (comment.id === args.data.parentCommentId) {
//           return {
//             ...comment,
//             '`childComments({"first":2,"order":"desc"})`': {
//               ...comment.childComments,
//               items: [
//                 ...comment.childComments.items,
//                 result.createComment
//               ]
//             }
//           }
//         } else {
//           return comment
//         }
//       })
//       // delete data.post.comments
//       const output = {
//         post: {
//           ...data.post,
//           comments
//         }
//       }
//       console.log('!@!!! output', output)
//       return output
//     })
//   } else {
//     cache.updateQuery({
//       query: postCommentsQuery,
//       variables: {
//         postId: args.data.postId
//       }
//     }, data => {
//       return {
//         post: {
//           ...data.post,
//           comments: {
//             ...data.post.comments,
//             items: [
//               ...data.post.comments.items,
//               {
//                 ...result.createComment,
//                 parentComment: null,
//                 myReactions: [],
//                 commentReactions: [],
//                 '`childComments({"first":2,"order":"desc"})`': {
//                     hasMore: false,
//                     items: [],
//                     total: 0
//                 }
//               }
//             ]
//           }
//         }
//       }
//     })
//   }
// }
