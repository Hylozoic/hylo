import { GraphQLError } from 'graphql'

export async function createModerationAction ({ userId, data }) {
  const { groupId, text, anonymous, commentId } = data
  const agreements = data.agreements || []
  const platformAgreements = data.platformAgreements || []
  let { postId } = data

  // A comment report files against the comment's own post, in the same group queue
  if (commentId) {
    const comment = await Comment.find(commentId)
    if (!comment || !comment.get('active')) throw new GraphQLError('Comment not found')
    if (postId && String(postId) !== String(comment.get('post_id'))) throw new GraphQLError('Comment not found')
    postId = comment.get('post_id')

    // Only comments on group posts go to a group queue, and only to a group the post is in
    // (or the parent group of a space it is in)
    const commentPost = await Post.find(postId)
    if (!commentPost || commentPost.isThread()) throw new GraphQLError('Comment not found')
    const postGroups = await commentPost.groups().fetch()
    const allowedGroupIds = new Set()
    postGroups.forEach(g => {
      allowedGroupIds.add(String(g.id))
      if (g.get('parent_id')) allowedGroupIds.add(String(g.get('parent_id')))
    })
    if (!groupId || !allowedGroupIds.has(String(groupId))) throw new GraphQLError('This comment is not in that group')
  }

  if (!userId || !postId || !text) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, text })}`)
  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to see this post")

  if (agreements.length === 0 && platformAgreements.length === 0) throw new GraphQLError('No agreements or platform agreements provided; you need to report against at least one of these')

  return ModerationAction.create({ postId, commentId, reporterId: userId, groupId, text, anonymous, agreements, platformAgreements })
    .catch((err) => { throw new GraphQLError(`adding of action failed: ${err}`) })
    .then((result) => {
      Queue.classMethod('ModerationAction', 'sendToModerators', {
        moderationActionId: result.id,
        anonymous,
        groupId,
        postId
      })

      Queue.classMethod('ModerationAction', 'sendEmailsForModerationAction', {
        reporterId: userId,
        groupId,
        postId,
        commentId: commentId || null,
        type: 'created'
      })

      return result
    })
}

/**
 * Report a person, or a direct message conversation, to Hylo staff. The report
 * lands in the staff queue in Management, not in any group's moderation queue.
 */
export async function reportToStaff ({ userId, data = {} }) {
  const { reportedUserId, messageThreadId, category } = data
  const text = (data.text || '').trim()
  if (!userId) throw new GraphQLError('You must be logged in')
  if (!reportedUserId && !messageThreadId) throw new GraphQLError('Nothing to report')
  if (!ModerationAction.STAFF_CATEGORIES.includes(category)) throw new GraphQLError('Unknown category')
  if (category === 'other' && !text) throw new GraphQLError('Please explain what happened')
  if (text.length > 5000) throw new GraphQLError('Explanation is too long')

  let reportedId = reportedUserId || null
  if (reportedId) {
    if (String(reportedId) === String(userId)) throw new GraphQLError("You can't report yourself")
    const reported = await User.find(reportedId)
    if (!reported) throw new GraphQLError('Person not found')
  }

  if (messageThreadId) {
    const thread = await Post.find(messageThreadId)
    if (!thread || !thread.isThread()) throw new GraphQLError('Message thread not found')
    const postUser = await PostUser.find(messageThreadId, userId)
    if (!postUser || !postUser.get('following') || !postUser.get('active')) {
      throw new GraphQLError('You are not a participant in this thread')
    }
    // In a one-to-one conversation the report is about the other person
    if (!reportedId) {
      const followers = await thread.followers().fetch()
      const others = followers.filter(f => String(f.id) !== String(userId))
      if (others.length === 1) reportedId = others[0].id
    }
  }

  await ModerationAction.createStaffReport({
    reporterId: userId,
    reportedUserId: reportedId,
    messageThreadId: messageThreadId || null,
    category,
    text: text || null
  })
  return { success: true }
}

export async function resolveStaffReport ({ userId, id }) {
  if (!(await Admin.isSuperAdmin(userId))) throw new GraphQLError('Unauthorized: Admin access required')
  try {
    await ModerationAction.resolveStaffReport({ id, userId })
  } catch (err) {
    throw new GraphQLError(err.message)
  }
  return { success: true }
}

export async function clearModerationAction ({ userId, postId, groupId, moderationActionId }) {
  if (!userId || !postId || !groupId || !moderationActionId) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, groupId, moderationActionId })}`)

  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post does not exist')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  const modAction = await ModerationAction.where({ id: moderationActionId }).fetch()

  if (!responsibilities.includes(Responsibility.constants.RESP_MANAGE_CONTENT) && modAction.get('reporter_id') !== userId) throw new GraphQLError("You don't have permission to moderate this post")

  return ModerationAction.clearAction({ moderationActionId, userId, postId, groupId })
    .then(action => {
      Queue.classMethod('ModerationAction', 'sendEmailsForModerationAction', {
        reporterId: userId,
        groupId,
        postId,
        commentId: action.get('comment_id') || null,
        type: 'cleared'
      })
      return { success: true }
    })
}

export function recordClickthrough ({ userId, postId }) {
  return Post.find(postId)
    .then(async post => {
      const authorized = await Post.isVisibleToUser(postId, userId)
      if (!authorized) throw new GraphQLError("You don't have permission to see this post")
      return PostUser.clickthroughModeration({ userId, postId })
    })
    .then(() => ({ success: true }))
}
