import { GraphQLError } from 'graphql'

/** Subscribe the user to updates on a post. */
export async function followPost (userId, postId) {
  if (!userId) throw new GraphQLError('You must be logged in')
  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  await post.addFollowers([userId])
  return Post.find(postId)
}

/** Stop updates on a post. Saves and project roles stay in place. */
export async function unfollowPost (userId, postId) {
  if (!userId) throw new GraphQLError('You must be logged in')
  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  await post.updateFollowers([userId], { following: false })
  return Post.find(postId)
}
