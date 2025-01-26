import { GraphQLYogaError } from '@graphql-yoga/node'
import { merge, trim } from 'lodash'
import { includes } from 'lodash/fp'

import underlyingDeleteComment from '../../models/comment/deleteComment'
import underlyingCreateComment from '../../models/comment/createComment'
import underlyingUpdateComment from '../../models/comment/updateComment'

export async function canDeleteComment (userId, comment) {
  if (comment.get('user_id') === userId) return true

  const commentWithGroups = await comment.load('post.groups')

  return commentWithGroups.relations.post.relations.groups.map(g =>
    GroupMembership.hasResponsibility(userId, g, Responsibility.constants.RESP_MANAGE_CONTENT)
  )
}

export async function canUpdateComment (userId, comment) {
  if (comment.get('user_id') === userId) {
    return true
  } else {
    throw new GraphQLYogaError("You don't have permission to edit this comment")
  }
}

export async function deleteComment (userId, commentId) {
  const comment = await Comment.find(commentId)
  const canDelete = await canDeleteComment(userId, comment)

  if (!canDelete) throw new GraphQLYogaError("You don't have permission to delete this comment")

  await underlyingDeleteComment(comment, userId)

  return { success: true }
}

export async function createComment (userId, data, context) {
  await validateCommentCreateData(userId, data)

  const { postId, parentCommentId } = data
  const post = await Post.find(postId)
  const parentComment = parentCommentId ? await Comment.find(parentCommentId) : null
  const comment = await underlyingCreateComment(userId, merge(data, { post, parentComment }))

  context.pubSub.publish(`comment:postId:${postId}`, { comment })

  if (parentComment && parentCommentId) {
    context.pubSub.publish(`comment:parentCommentId:${parentCommentId}`, { comment })
  }

  return comment
}

export async function createMessage (userId, data, context) {
  const { messageThreadId: postId } = data
  await validateCommentCreateData(userId, { ...data, postId })

  const post = await Post.find(postId)
  const postCommentsTotal = await post.commentsTotal()
  const newThread = !postCommentsTotal || postCommentsTotal < 1
  const followers = await post.followers().fetch()
  const blockedUsers = await BlockedUser.blockedFor(userId)
  const blockedUserIds = blockedUsers.rows.map(r => r.user_id)
  const otherParticipants = followers.filter(f => f.id !== userId && !includes(f.id, blockedUserIds))

  if (otherParticipants.length < 1) throw new GraphQLYogaError('cannot send a message to this thread')

  const comment = await underlyingCreateComment(userId, merge(data, { post }))

  // TODO: PROBABLY deprecate message subscription
  context.pubSub.publish(`message:messageThreadId:${postId}`, { message: comment })

  // Notify all participants of a new messageThread after first new message (comment) created
  otherParticipants.forEach(participant => {
    if (newThread) {
      context.pubSub.publish(`updates:${participant.id}`, { messageThread: post })
    } else {
      context.pubSub.publish(`updates:${participant.id}`, { message: comment })
    }
  })

  return comment
}

export async function updateComment (userId, { id, data }, context) {
  await validateCommentUpdateData(userId, data)

  const commentToValidate = await Comment.find(id)
  await canUpdateComment(userId, commentToValidate)

  const comment = await underlyingUpdateComment(userId, id, data)

  context.pubSub.publish(`comment:postId:${comment.get('post_id')}`, { comment })

  if (comment.get('comment_id')) {
    context.pubSub.publish(`comment:parentCommentId:${comment.get('comment_id')}`, { comment })
  }

  return comment
}

export async function validateCommentCreateData (userId, data) {
  const isVisible = await Post.isVisibleToUser(data.postId, userId)

  if (isVisible) {
    if (!data.imageUrl && !trim(data.text)) {
      throw new GraphQLYogaError("Can't create a blank comment")
    }
    return data
  } else {
    throw new GraphQLYogaError('post not found')
  }
}

export async function validateCommentUpdateData (userId, data) {
  if (!data.imageUrl && !trim(data.text)) {
    throw new GraphQLYogaError("Can't create a blank comment")
  }
  return data
}
