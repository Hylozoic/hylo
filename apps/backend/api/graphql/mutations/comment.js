import { GraphQLYogaError } from '@graphql-yoga/node'
import { merge, trim } from 'lodash'
import { includes } from 'lodash/fp'

import underlyingDeleteComment from '../../models/comment/deleteComment'
import underlyingCreateComment from '../../models/comment/createComment'
import underlyingUpdateComment from '../../models/comment/updateComment'

export async function canDeleteComment (userId, comment) {
  if (comment.get('user_id') === userId) return Promise.resolve(true)
  return comment.load('post.groups')
    .then(comment => Promise.any(
      comment.relations.post.relations.groups.map(g =>
        GroupMembership.hasResponsibility(userId, g, Responsibility.constants.RESP_MANAGE_CONTENT))
    ))
}

export function canUpdateComment (userId, comment) {
  if (comment.get('user_id') === userId) return Promise.resolve(true)
  return Promise.resolve(false)
}

export function deleteComment (userId, commentId) {
  return Comment.find(commentId)
    .then(comment => canDeleteComment(userId, comment)
      .then(canDelete => {
        if (!canDelete) throw new GraphQLYogaError("You don't have permission to delete this comment")
        return underlyingDeleteComment(comment, userId)
      }))
    .then(() => ({ success: true }))
}

export async function createComment (userId, data, context) {
  await validateCommentCreateData(userId, data)

  const { postId, parentCommentId } = data
  const post = await Post.find(postId)
  const parentComment = parentCommentId ? await Comment.find(parentCommentId) : null
  const bookshelfComment = await underlyingCreateComment(userId, merge(data, { post, parentComment }))

  context.pubSub.publish(`comment:postId:${postId}`, { comment: bookshelfComment })

  if (parentComment && parentCommentId) {
    context.pubSub.publish(`comment:parentCommentId:${parentCommentId}`, { comment: bookshelfComment })
  }

  return bookshelfComment
}

export async function createMessage (userId, data, context) {
  const post = await Post.find(data.messageThreadId)
  const followers = await post.followers().fetch()
  const blockedUserIds = (await BlockedUser.blockedFor(userId)).rows.map(r => r.user_id)
  const otherParticipants = followers.filter(f => f.id !== userId && !includes(f.id, blockedUserIds))

  if (otherParticipants.length < 1) throw new GraphQLYogaError('cannot send a message to this thread')

  data.postId = data.messageThreadId

  return createComment(userId, data, context)
}

export async function updateComment (userId, { id, data }, context) {
  const comment = await Comment.find(id)
  const canUpdate = await canUpdateComment(userId, comment)

  if (!canUpdate) throw new GraphQLYogaError("You don't have permission to edit this comment")

  const validatedData = await validateCommentUpdateData(userId, data)
  const bookshelfComment = await underlyingUpdateComment(userId, id, validatedData)

  context.pubSub.publish(`comment:${id}`, { comment: bookshelfComment })
  context.pubSub.publish(`comment:postId:${bookshelfComment.get('post_id')}`, { comment: bookshelfComment })

  if (bookshelfComment.get('comment_id')) {
    context.pubSub.publish(`comment:parentCommentId:${bookshelfComment.get('comment_id')}`, { comment: bookshelfComment })
  }

  return bookshelfComment
}

export function validateCommentCreateData (userId, data) {
  return Post.isVisibleToUser(data.postId, userId)
    .then(isVisible => {
      if (isVisible) {
        if (!data.imageUrl && !trim(data.text)) {
          throw new GraphQLYogaError("Can't create a blank comment")
        }
        return Promise.resolve()
      } else {
        throw new GraphQLYogaError('post not found')
      }
    })
}

export function validateCommentUpdateData (userId, data) {
  if (!data.imageUrl && !trim(data.text)) {
    throw new GraphQLYogaError("Can't create a blank comment")
  }
  return Promise.resolve(data)
}
