import { postCommentsQuery, childCommentsQuery } from 'components/Comments/Comments'

const createComment = (args, cache, info) => {
  // console.log('!!!! optimistic', args)
  // return null
  const currentUser = cache.resolve({ __typename: 'Query' }, 'me')
  const currentUserId = cache.resolve(currentUser, 'id')

  return {
    __typename: 'Comment',
    id: `optimistic-comment-for-post-id-${args.data.postId}`,
    text: args.data.text + '+ optimistic!',
    creator: {
      __typename: 'Person',
      id: currentUserId
    },
    post: {
      __typename: 'Post',
      id: args.data.postId
    },
    childComments: {
      __typename: 'CommentQuerySet',
      items: [],
      total: 0,
      hasMore: false
    },
    // parentComment: {
    //   __typename: 'Person',
    //   id: args.data.parentCommentId
    // },
    attachments: [],
    createdAt: new Date().toISOString()
  }

  // return {
  //   __typename: 'Comment',
  //   id: `optimistic-comment-for-post-id${args.data.postId}`,
  //   text: args.data.text + '+ optimistic!',
  //   creator: {
  //     __typename: 'Person',
  //     id: currentUserId
  //   },
  //   parentComment: {
  //     __typename: 'Person',
  //     id: args.data.parentCommentId
  //   },
  //   attachments: [],
  //   createdAt: new Date().toISOString()
  // }
  // const data = cache.updateQuery({ query: postCommentsQuery, variables: { postId: args.data.postId } }, data => {
  //   const { post } = data
  //   const { createComment: newComment } = result
  //   return {
  //     post: {
  //       __typename: 'Post',
  //       ...post,
  //       comments: {
  //         __typename: 'CommentQuerySet',
  //         ...post.comments,
  //         items: [
  //           ...post.comments.items,
  //           {
  //             ...newComment,
  //             __typename: 'Comment',
  //             childComments: {
  //               ___typename: 'CommentQuerySet',
  //               items: [],
  //               total: 0,
  //               hasMore: false
  //             }
  //           }
  //         ]
  //       }
  //     }
  //   }
  // })
}

// const createComment = (args, cache, info) => {
//   const postId = args.data.postId
//   const currentUser = cache.resolve({ __typename: 'Query' }, 'me')
//   const currentUserId = cache.resolve(currentUser, 'id')
//   // const optimisticComment = {
//   //   __typename: 'Comment',
//   //   id: `optimistic-comment-for-post-id-${postId}`,
//   //   text: args.data.text,
//   //   post: {
//   //     __typename: 'Post',
//   //     id: postId
//   //   },
//   //   creator: {
//   //     __typename: 'Person',
//   //     id: currentUserId
//   //   },
//   //   attachments: args.data.attachments || []
//   // }
//   // if (args.data.parentCommentId) {
//   //   optimisticComment.parentComment = {
//   //     __typename: 'Comment',
//   //     id: args.data.parentCommentId
//   //   }
//   // }
//   // optimisticComment.createdAt = new Date().toISOString()
//   // const data = cache.readQuery({ query: postCommentsQuery, variables: { postId: args.data.postId } })

//   // console.log('!!! optimisticComment data', data)
//   return {
//     __typename: 'Comment',
//     id: 10101010,
//     text: args.data.text + 'OPTIMISTIC',
//     creator: {
//       __typename: 'Person',
//       id: currentUserId
//     },
//     post: {
//       id: postId
//     }
//   }
// }

export default {
  // TODO: This doesn't end-up with an optimistic result that goes into the
  // comment selections sets it should go into. Likely the reason is that 
  // some part of the expected data for the comment is not being returned in
  // the optimistic response constructed below, and therefore results in a cache
  // miss and isn't added to the list until a fetch is complete (which the
  // completion of the mutation likely fulfills). Needs further exploration:
  // createComment
}
