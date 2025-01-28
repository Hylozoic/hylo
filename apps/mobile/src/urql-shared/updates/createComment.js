export default function createComment (result, args, cache) {
  const parentId = args?.data?.parentCommentId || args?.data?.postId

  if (parentId) {
    const parentTypeName = args?.data?.parentCommentId ? 'Comment' : 'Post'
    const commentsFieldName = args?.data?.parentCommentId ? 'childComments' : 'comments'
    const newComment = result.createComment
    const parentKey = cache.keyOfEntity({ __typename: parentTypeName, id: parentId })
    const commentsFields = cache.inspectFields(parentKey).filter(fi => fi.fieldName === commentsFieldName)

    if (commentsFields.length > 0) {
      const { fieldKey } = commentsFields[0]
      const commentsKey = cache.resolve(parentKey, fieldKey)

      if (commentsKey) {
        const items = cache.resolve(commentsKey, 'items') || []
        const newCommentKey = cache.keyOfEntity(newComment)

        // Append the new comment to the items array
        const updatedItems = [...items, newCommentKey]

        // Link the updated items array back to the comments field
        cache.link(commentsKey, 'items', updatedItems)
      }
    }
  }
}
