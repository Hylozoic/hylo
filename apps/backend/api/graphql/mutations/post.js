import { GraphQLError } from 'graphql'
import { PINNABLE_VIEW_TYPES, MAX_PINNED_POSTS_PER_VIEW } from '@hylo/shared'
import validatePostData from '../../models/post/validatePostData'
import underlyingCreatePost from '../../models/post/createPost'
import underlyingUpdatePost from '../../models/post/updatePost'
import {
  assertCanFulfillPost,
  notifyAuthorOfModeratorFulfillment
} from '../../models/post/postFulfillmentPermissions'
import { deletePostDraftForCreate } from './draft'

export async function completePost (userId, postId, completionResponse) {
  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  const jsonResponse = typeof completionResponse === 'string'
    ? completionResponse
    : JSON.stringify(completionResponse)

  await post.complete(userId, jsonResponse)
  return Post.find(postId)
}

export function createPost (userId, data) {
  return convertGraphqlPostData(data)
    .tap(convertedData => validatePostData(userId, convertedData))
    .then(async validatedData => {
      const createdPost = await underlyingCreatePost(userId, validatedData)
      await deletePostDraftForCreate(userId, {
        groupId: validatedData.group_ids?.[0],
        topicName: validatedData.type === 'chat' ? validatedData.topicNames?.[0] : null,
        postType: validatedData.type || null
      })
      return createdPost
    })
}

export function deletePost (userId, postId) {
  return Post.find(postId)
    .then(post => {
      if (!post) {
        throw new GraphQLError('Post does not exist')
      }
      if (post.get('user_id') !== userId) {
        throw new GraphQLError("You don't have permission to modify this post")
      }
      const isEvent = post.isEvent()
      return Post.deactivate(postId).then(() => isEvent)
    })
    .then(isEvent => {
      isEvent && Queue.classMethod('Post', 'processEventDeleted', { postId })
      return { success: true }
    })
}

export function updatePost (userId, { id, data }) {
  return convertGraphqlPostData(data)
    .tap(convertedData => validatePostData(userId, convertedData))
    .then(validatedData => underlyingUpdatePost(userId, id, validatedData))
}

export async function fulfillPost (userId, postId) {
  const post = await Post.find(postId)
  await assertCanFulfillPost(userId, post)
  const isModeratorAction = post.get('user_id') !== userId
  await post.fulfill()
  Post.afterRelatedMutation(postId, { changeContext: 'completion' })
  if (isModeratorAction) {
    await notifyAuthorOfModeratorFulfillment({ post, actorId: userId, fulfilled: true })
  }
  return { success: true }
}

export async function unfulfillPost (userId, postId) {
  const post = await Post.find(postId)
  await assertCanFulfillPost(userId, post)
  const isModeratorAction = post.get('user_id') !== userId
  await post.unfulfill()
  Post.afterRelatedMutation(postId, { changeContext: 'completion' })
  if (isModeratorAction) {
    await notifyAuthorOfModeratorFulfillment({ post, actorId: userId, fulfilled: false })
  }
  return { success: true }
}

export async function addProposalVote ({ userId, postId, optionId }) {
  if (!userId || !postId || !optionId) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, optionId })}`)

  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to vote on this post")

  return Post.find(postId)
    .then(async post => {
      if (post.get('proposal_status') !== Post.Proposal_Status.VOTING && post.get('proposal_status') !== Post.Proposal_Status.CASUAL) throw new GraphQLError('Cannot vote on a proposal that is in discussion or completed')
      await post.addFollowers([userId])
      return post.addProposalVote({ userId, optionId })
    })
    .catch((err) => { throw new GraphQLError(`adding of vote failed: ${err}`) })
    .then(() => ({ success: true }))
}

export async function removeProposalVote ({ userId, postId, optionId }) {
  if (!userId || !postId || !optionId) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, optionId })}`)

  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to vote on this post")
  return Post.find(postId)
    .then(post => {
      if (post.get('proposal_status') !== Post.Proposal_Status.VOTING && post.get('proposal_status') !== Post.Proposal_Status.CASUAL) throw new GraphQLError('Cannot vote on a proposal that is in discussion or completed')
      return post.removeProposalVote({ userId, optionId })
    })
    .catch((err) => { throw new GraphQLError(`removal of vote failed: ${err}`) })
    .then(() => ({ success: true }))
}

export async function setProposalOptions ({ userId, postId, options }) {
  if (!userId || !postId || !options) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, options })}`)
  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to modify this post")
  return Post.find(postId)
    .then(post => {
      if (post.get('proposal_status') !== Post.Proposal_Status.DISCUSSION) throw new GraphQLError("Proposal options cannot be changed unless the proposal is in 'discussion'")
      return post.setProposalOptions({ options })
    })
    .catch((err) => { throw new GraphQLError(`setting of options failed: ${err}`) })
    .then(() => ({ success: true }))
}

export async function updateProposalOptions ({ userId, postId, options }) {
  if (!userId || !postId || !options) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, options })}`)
  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to modify this post")
  return Post.find(postId)
    .then(post => {
      if (post.get('proposal_status') === Post.Proposal_Status.COMPLETED && post.get('proposal_status') !== Post.Proposal_Status.CASUAL) throw new GraphQLError("Proposal options cannot be changed once a proposal is complete'")
      return post.updateProposalOptions({ options, userId })
    })
    .catch((err) => { throw new GraphQLError(`setting of options failed: ${err}`) })
    .then(() => ({ success: true }))
}

export async function swapProposalVote ({ userId, postId, removeOptionId, addOptionId }) {
  if (!userId || !postId || !removeOptionId || !addOptionId) throw new GraphQLError(`Missing required parameters: ${JSON.stringify({ userId, postId, removeOptionId, addOptionId })}`)
  const authorized = await Post.isVisibleToUser(postId, userId)
  if (!authorized) throw new GraphQLError("You don't have permission to vote on this post")
  if (removeOptionId === addOptionId) throw new GraphQLError('You cannot swap a vote for the same option')

  const post = await Post.find(postId)
  if (!post) throw new GraphQLError(`Couldn't find post for ${postId}`)
  if (post.get('proposal_status') !== Post.Proposal_Status.VOTING && post.get('proposal_status') !== Post.Proposal_Status.CASUAL) throw new GraphQLError('Cannot vote on a proposal that is in discussion or completed')

  try {
    await post.removeProposalVote({ userId, optionId: removeOptionId })
    await post.addProposalVote({ userId, optionId: addOptionId })
    return { success: true }
  } catch (err) {
    throw new GraphQLError(`swap of vote failed: ${err}`)
  }
}

export function updateProposalOutcome ({ userId, postId, proposalOutcome }) {
  return Post.find(postId)
    .then(post => {
      if (post.get('user_id') !== userId) {
        throw new GraphQLError("You don't have permission to modify this post")
      }
      return post.updateProposalOutcome(proposalOutcome)
    })
    .then(() => ({ success: true }))
}

export async function pinPost (userId, postId, viewId) {
  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError("Couldn't find view")

  if (!PINNABLE_VIEW_TYPES.includes(view.get('type'))) {
    throw new GraphQLError('Posts cannot be pinned to this view')
  }

  const group = await Group.find(view.get('group_id'))
  const isModerator = await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_CONTENT)
  if (!isModerator) throw new GraphQLError("You don't have permission to modify this group")

  const postMembership = await PostMembership.find(postId, group.id)
  if (!postMembership) throw new GraphQLError("Couldn't find post in this group")

  const existing = await GroupViewPin.find(viewId, postId)
  if (existing) {
    await existing.destroy()
    return { success: true }
  }

  const count = await GroupViewPin.countForView(viewId)
  if (count >= MAX_PINNED_POSTS_PER_VIEW) {
    throw new GraphQLError('You can pin up to 3 posts in this view')
  }

  await GroupViewPin.create({
    view_id: viewId,
    post_id: postId,
    pinned_at: new Date()
  })
  return { success: true }
}

// converts input data from the way it's received in GraphQL to the format that
// the legacy code expects -- this sort of thing can be removed/refactored once
// hylo-redux is no longer in use
function convertGraphqlPostData (data) {
  return Promise.resolve(Object.assign({
    name: data.title,
    description: data.details,
    link_preview_id: data.linkPreviewId,
    link_preview_featured: data.linkPreviewFeatured,
    group_ids: data.groupIds,
    parent_post_id: data.parentPostId,
    location_id: data.locationId,
    location: data.location,
    meeting_link: data.meetingLink,
    is_public: data.isPublic
  }, data))
}
