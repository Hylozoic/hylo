export default {
  // TODO: This doesn't end-up with an optimistic result that goes into the
  // comment selections sets it should go into. Likely the reason is that
  // some part of the expected data for the comment is not being returned in
  // the optimistic response constructed below, and therefore results in a cache
  // miss and isn't added to the list until a fetch is complete (which the
  // completion of the mutation likely fulfills). Needs further exploration:
  // createComment: (args, cache, info) => {
  //   const postId = args.data.postId
  //   const currentUser = cache.resolve({ __typename: 'Query' }, 'me')
  //   const currentUserId = cache.resolve(currentUser, 'id')
  //   const optimisticComment = {
  //     __typename: 'Comment',
  //     id: `optimistic-comment-for-post-id-${postId}`,
  //     text: args.data.text,
  //     post: {
  //       __typename: 'Post',
  //       id: postId
  //     },
  //     creator: {
  //       __typename: 'Person',
  //       id: currentUserId
  //     },
  //     attachments: args.data.attachments || []
  //   }
  //   if (args.data.parentCommentId) {
  //     optimisticComment.parentComment = {
  //       __typename: 'Comment',
  //       id: args.data.parentCommentId
  //     }
  //   }
  //   optimisticComment.createdAt = new Date().toISOString()
  //   console.log('!!! optimisticComment', optimisticComment)
  //   return optimisticComment
  // }
}
