import { GraphQLError } from 'graphql'

export async function savePost (userId, postId) {
  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  const postUser = await PostUser.find(postId, userId)

  if (postUser) {
    // Update existing record
    await postUser.updateAndSave({
      saved_at: new Date()
    })
  } else {
    // Create new record
    await PostUser.forge({
      post_id: postId,
      user_id: userId,
      saved_at: new Date(),
      following: true,
      active: true,
      created_at: new Date()
    }).save()
  }

  return Post.find(postId)
}

export async function unsavePost (userId, postId) {
  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  const postUser = await PostUser.find(postId, userId)

  if (postUser) {
    await postUser.updateAndSave({
      saved_at: null
    })
  }

  return Post.find(postId)
}

