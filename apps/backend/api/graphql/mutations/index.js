import { GraphQLError } from 'graphql'
import { isEmpty, mapKeys, pick, snakeCase, size, trim } from 'lodash'
import convertGraphqlData from './convertGraphqlData'

export {
  createAffiliation,
  deleteAffiliation
} from './affiliation'
export {
  createCollection,
  addPostToCollection,
  reorderPostInCollection,
  removePostFromCollection
} from './collection'
export {
  createComment,
  createMessage,
  deleteComment,
  canDeleteComment,
  updateComment,
  canUpdateComment
} from './comment'
export {
  createContextWidget,
  updateContextWidget,
  removeWidgetFromMenu,
  reorderContextWidget,
  setHomeWidget
} from './context_widgets'
export {
  respondToEvent,
  invitePeopleToEvent
} from './event'
export {
  acceptGroupRelationshipInvite,
  addMember,
  addModerator,
  cancelGroupRelationshipInvite,
  createGroup,
  deleteGroup,
  deleteGroupRelationship,
  deleteGroupTopic,
  inviteGroupToGroup,
  joinGroup,
  regenerateAccessCode,
  rejectGroupRelationshipInvite,
  removeModerator,
  removeMember,
  updateGroup
} from './group'
export {
  createInvitation,
  expireInvitation,
  resendInvitation,
  reinviteAll,
  useInvitation
} from './invitation'
export {
  acceptJoinRequest,
  cancelJoinRequest,
  createJoinRequest,
  declineJoinRequest
} from './join_request'
export {
  findOrCreateLocation
} from './location'
export { updateAllMemberships, updateMembership } from './membership'
export { registerDevice } from './mobile'
export {
  completePost,
  createPost,
  fulfillPost,
  unfulfillPost,
  setProposalOptions,
  addProposalVote,
  removeProposalVote,
  swapProposalVote,
  updatePost,
  updateProposalOptions,
  updateProposalOutcome,
  deletePost,
  pinPost
} from './post'
export {
  createModerationAction,
  clearModerationAction,
  recordClickthrough
} from './moderation_actions'
export {
  addPeopleToProjectRole,
  createProject,
  createProjectRole,
  deleteProjectRole,
  joinProject,
  leaveProject,
  processStripeToken
} from './project'
export {
  addGroupResponsibility,
  updateGroupResponsibility,
  deleteGroupResponsibility,
  addResponsibilityToRole,
  removeResponsibilityFromRole
} from './responsibilities'
export {
  addGroupRole,
  addRoleToMember,
  removeRoleFromMember,
  updateGroupRole
} from './role'
export { deleteSavedSearch, createSavedSearch } from './savedSearch'
export {
  createTopic,
  subscribe
} from './topic'
export {
  createTrack,
  deleteTrack,
  duplicateTrack,
  enrollInTrack,
  leaveTrack,
  updateTrack,
  updateTrackActionOrder
} from './track'
export {
  blockUser,
  deactivateUser,
  deleteUser,
  login,
  logout,
  reactivateUser,
  register,
  registerStripeAccount,
  sendEmailVerification,
  sendPasswordReset,
  unblockUser,
  updateStripeAccount,
  verifyEmail
} from './user'
export {
  createZapierTrigger,
  deleteZapierTrigger
} from './zapier'
export { default as findOrCreateThread } from '../../models/post/findOrCreateThread'

export async function updateMe (sessionId, userId, changes) {
  const user = await User.find(userId)
  return user.validateAndSave(sessionId, convertGraphqlData(changes))
}

export function allowGroupInvites (groupId, data) {
  return Group.where('id', groupId).fetch()
    .then(g => g.addSetting({ allow_group_invites: data }, true))
    .then(() => ({ success: true }))
}

export async function leaveGroup (userId, groupId) {
  const group = await Group.find(groupId)
  const user = await User.find(userId)
  await user.leaveGroup(group)
  return groupId
}

export async function findOrCreateLinkPreviewByUrl ({ url }) {
  const preview = await LinkPreview.find(url)

  if (!preview) return LinkPreview.queue(url)
  if (!preview.get('done')) return

  return preview
}

export function updateGroupTopic (id, data) {
  const whitelist = mapKeys(pick(data, ['visibility', 'isDefault']), (v, k) => snakeCase(k))
  if (isEmpty(whitelist)) return Promise.resolve(null)

  return GroupTag.query().where({ id }).update(whitelist)
    .then(() => ({ success: true }))
}

export function updateGroupTopicFollow (userId, { id, data }) {
  const whitelist = mapKeys(pick(data, ['newPostCount', 'lastReadPostId']), (v, k) => snakeCase(k))
  if (isEmpty(whitelist)) return Promise.resolve(null)

  return GroupTag.where({ id }).fetch()
    .then(ct => ct.tagFollow(userId).query().update(whitelist))
    .then(() => ({ success: true }))
}

export async function updateTopicFollow (userId, { id, data }) {
  const whitelist = mapKeys(pick(data, ['newPostCount', 'lastReadPostId']), (v, k) => snakeCase(k))
  const tagFollow = await TagFollow.where({ id }).fetch()
  if (['all', 'none', 'important'].includes(data.settings?.notifications)) {
    if (!tagFollow.settings?.notifications) {
      // If notifications are being set for the first time, this counts as "subscribing" to the chat room
      //  Set the lastReadPostId to the most recent post id so when viewing the chat room for the first time you start at the latest post
      //  and set the newPostCount to 0 because there are no new posts
      whitelist.last_read_post_id = await Post.query(q => q.select(bookshelf.knex.raw('max(posts.id) as max'))).fetch().then(result => result.get('max'))

      whitelist.new_post_count = 0
    }
    const newSettings = tagFollow.settings || {}
    newSettings.notifications = data.settings.notifications
    whitelist.settings = JSON.stringify(newSettings)
  }

  if (whitelist.last_read_post_id && typeof whitelist.new_post_count !== 'number') {
    // Update newPostCount based on how many more posts after the lastReadPostId
    const newPostCount = await GroupTag.taggedPostCount(tagFollow.get('group_id'), tagFollow.get('tag_id'), whitelist.last_read_post_id)
    whitelist.new_post_count = newPostCount
  }

  if (isEmpty(whitelist)) return Promise.resolve(null)
  return tagFollow.save(whitelist)
}

export function markActivityRead (userId, activityid) {
  return Activity.find(activityid)
    .then(a => {
      if (a.get('reader_id') !== userId) return
      return a.save({ unread: false })
    })
}

export function markAllActivitiesRead (userId) {
  return Activity.query().where('reader_id', userId).update({ unread: false })
    .then(() => ({ success: true }))
}

export async function markThreadRead (root, { messageThreadId }, context) {
  const messageThread = await Post.find(messageThreadId)
  await messageThread.markAsRead(context.currentUserId)
  return messageThread
}

export function unlinkAccount (userId, provider) {
  return User.find(userId)
    .then(user => {
      if (!user) throw new GraphQLError(`Couldn't find user with id ${userId}`)
      return user.unlinkAccount(provider)
    })
    .then(() => ({ success: true }))
}

async function createSkill (name) {
  name = trim(name)
  if (isEmpty(name)) {
    throw new GraphQLError('Skill cannot be blank')
  } else if (size(name) > 39) {
    throw new GraphQLError('Skill must be less than 40 characters')
  }
  let skill
  try {
    skill = await Skill.forge({ name }).save()
  } catch (err) {
    if (!err.message || !err.message.includes('duplicate')) {
      throw err
    }
    skill = await Skill.find(name)
  }
  return skill
}

export async function addSkill (userId, name) {
  const skill = await createSkill(name)

  try {
    await skill.users().attach({ user_id: userId })
  } catch (err) {
    if (!err.message || !err.message.includes('duplicate')) {
      throw err
    }
  }

  return skill
}

export async function addSkillToLearn (userId, name) {
  const skill = await createSkill(name)

  try {
    await skill.usersLearning().attach({ user_id: userId, type: Skill.Type.LEARNING })
  } catch (err) {
    if (!err.message || !err.message.includes('duplicate')) {
      throw err
    }
  }

  return skill
}

export async function addSuggestedSkillToGroup (userId, groupId, name) {
  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Invalid group')
  const isAdministrator = GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION, {})
  if (!isAdministrator) throw new GraphQLError('You don\'t have permission to add skill to group')

  const skill = await createSkill(name)

  try {
    await group.suggestedSkills().attach({ skill_id: skill.id })
  } catch (err) {
    if (!err.message || !err.message.includes('duplicate')) {
      throw err
    }
  }

  return skill
}

export function removeSkill (userId, skillIdOrName) {
  return Skill.find(skillIdOrName)
    .then(skill => {
      if (!skill) throw new GraphQLError(`Couldn't find skill with ID or name ${skillIdOrName}`)
      return skill.users().detach({ user_id: userId, type: Skill.Type.HAS })
    })
    .then(() => ({ success: true }))
}

export function removeSkillToLearn (userId, skillIdOrName) {
  return Skill.find(skillIdOrName)
    .then(skill => {
      if (!skill) throw new GraphQLError(`Couldn't find skill with ID or name ${skillIdOrName}`)
      return skill.usersLearning().detach({ user_id: userId, type: Skill.Type.LEARNING })
    })
    .then(() => ({ success: true }))
}

export async function removeSuggestedSkillFromGroup (userId, groupId, skillIdOrName) {
  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Invalid group')
  const isAdministrator = GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION)
  if (!isAdministrator) throw new GraphQLError('You don\'t have permission to remove skill from group')

  return Skill.find(skillIdOrName)
    .then(skill => {
      if (!skill) throw new GraphQLError(`Couldn't find skill with ID or name ${skillIdOrName}`)
      return group.suggestedSkills().detach({ skill_id: skill.id })
    })
    .then(() => ({ success: true }))
}

// TODO COMOD: This need to be left in place to handle comments and members flags. Although it doesn't seem like you can flag comments or members in EVO atm...
export function flagInappropriateContent (userId, { category, reason, linkData }) {
  let link
  // TODO use FlaggedItem.Type
  switch (trim(linkData.type)) {
    case 'post':
      link = Frontend.Route.post(linkData.id, linkData.slug)
      break
    case 'comment':
      link = Frontend.Route.thread(linkData.id)
      break
    case 'member':
      link = Frontend.Route.profile(linkData.id)
      break
    default:
      return Promise.reject(new Error('Invalid Link Type'))
  }

  return FlaggedItem.create({
    user_id: userId,
    category,
    reason,
    link,
    object_id: linkData.id,
    object_type: linkData.type
  })
    .tap(flaggedItem => Queue.classMethod('FlaggedItem', 'notifyModerators', { id: flaggedItem.id }))
    .then(() => ({ success: true }))
}

export function messageGroupStewards (userId, groupId) {
  return Group.messageStewards(userId, groupId)
}

export function reactOn (userId, entityId, data, context) {
  const lookUp = {
    post: Post,
    comment: Comment
  }
  const { entityType } = data
  if (!['post', 'comment'].includes(entityType)) {
    throw new Error('entityType invalid: you need to say its a post or a comment')
  }
  return lookUp[entityType].find(entityId)
    .then(async entity => {
      const result = await entity.addReaction(userId, data.emojiFull)

      // Note subscriptions for reactions on posts are handled by the postUpdates subscription

      // If reacting to a comment, publish to comments subscription
      if (entityType === 'comment' && context?.pubSub) {
        const comment = await Comment.find(entityId, { withRelated: ['post'] })
        const postId = comment.get('post_id')

        if (process.env.NODE_ENV === 'development') {
          console.log(`📡 Publishing comment reaction update for comment ${entityId} on post ${postId}`)
        }

        context.pubSub.publish(`comments:postId:${postId}`, { comment })

        // Also publish to parent comment if this is a threaded comment
        const parentCommentId = comment.get('comment_id')
        if (parentCommentId) {
          context.pubSub.publish(`comments:commentId:${parentCommentId}`, { comment })
        }
      }

      return result
    })
}

export function deleteReaction (userId, entityId, data, context) {
  const lookUp = {
    post: Post,
    comment: Comment
  }
  const { entityType } = data
  if (!['post', 'comment'].includes(entityType)) {
    throw new Error('entityType invalid: you need to say its a post or a comment')
  }
  return lookUp[entityType].find(entityId)
    .then(async entity => {
      const result = await entity.deleteReaction(userId, data.emojiFull)

      // Note subscriptions for reactions on posts are handled by the postUpdates subscription

      // If deleting reaction from a comment, publish to comments subscription
      if (entityType === 'comment' && context?.pubSub) {
        const comment = await Comment.find(entityId, { withRelated: ['post'] })
        const postId = comment.get('post_id')

        if (process.env.NODE_ENV === 'development') {
          console.log(`📡 Publishing comment reaction deletion for comment ${entityId} on post ${postId}`)
        }

        context.pubSub.publish(`comments:postId:${postId}`, { comment })

        // Also publish to parent comment if this is a threaded comment
        const parentCommentId = comment.get('comment_id')
        if (parentCommentId) {
          context.pubSub.publish(`comments:commentId:${parentCommentId}`, { comment })
        }
      }

      return result
    })
}

export async function removePost (userId, postId, groupIdOrSlug) {
  const group = await Group.find(groupIdOrSlug)
  return Promise.join(
    Post.find(postId),
    GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_MANAGE_CONTENT),
    (post, isModerator) => {
      if (!post) throw new GraphQLError(`Couldn't find post with id ${postId}`)
      if (!isModerator) throw new GraphQLError('You don\'t have permission to remove this post')
      return post.removeFromGroup(groupIdOrSlug)
    })
    .then(() => ({ success: true }))
}

export function updateWidget (id, changes) {
  return GroupWidget.update(id, convertGraphqlData(changes))
}
