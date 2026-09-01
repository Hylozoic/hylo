import * as sessionReducers from './sessionReducers'
import {
  ACCEPT_GROUP_RELATIONSHIP_INVITE,
  ACCEPT_JOIN_REQUEST,
  ADD_PROPOSAL_VOTE_PENDING,
  CANCEL_GROUP_RELATIONSHIP_INVITE,
  CANCEL_JOIN_REQUEST,
  CLEAR_MODERATION_ACTION_PENDING,
  CREATE_COMMENT,
  CREATE_COMMENT_PENDING,
  CREATE_JOIN_REQUEST,
  CREATE_MESSAGE,
  CREATE_MESSAGE_PENDING,
  CREATE_POST,
  CREATE_MODERATION_ACTION,
  CREATE_MODERATION_ACTION_PENDING,
  CREATE_POST_PENDING,
  CREATE_PROJECT_PENDING,
  CREATE_GROUP_VIEW,
  DECLINE_JOIN_REQUEST,
  DELETE_DRAFT,
  DELETE_COMMENT_PENDING,
  DELETE_GROUP_VIEW,
  DELETE_GROUP_RELATIONSHIP,
  DELETE_POST_PENDING,
  PIN_POST_PENDING,
  FETCH_GROUP_DETAILS_PENDING,
  FETCH_GROUP_VIEWS,
  FETCH_MESSAGES_PENDING,
  FETCH_MY_DRAFTS,
  FETCH_POSTS,
  FETCH_VIEW_POSTS,
  FETCH_VIEW_PINNED_POSTS,
  INVITE_CHILD_TO_JOIN_PARENT_GROUP,
  INVITE_PEER_RELATIONSHIP,
  JOIN_PROJECT_PENDING,
  LEAVE_GROUP,
  LEAVE_PROJECT_PENDING,
  PROCESS_STRIPE_TOKEN_PENDING,
  REACT_ON_POST_PENDING,
  REACT_ON_COMMENT_PENDING,
  RECORD_CLICKTHROUGH_PENDING,
  REJECT_GROUP_RELATIONSHIP_INVITE,
  REMOVE_REACT_ON_COMMENT_PENDING,
  REMOVE_REACT_ON_POST_PENDING,
  REMOVE_DRAFT,
  REMOVE_DRAFT_BY_CONTEXT,
  REMOVE_POST_PENDING,
  REMOVE_PROPOSAL_VOTE_PENDING,
  REQUEST_FOR_CHILD_TO_JOIN_PARENT_GROUP,
  RESET_NEW_POST_COUNT_PENDING,
  RESPOND_TO_EVENT_PENDING,
  REORDER_GROUP_VIEW_PENDING,
  SWAP_PROPOSAL_VOTE_PENDING,
  SET_GROUP_VIEW_HIDDEN_PENDING,
  SET_HOME_VIEW_PENDING,
  TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING,
  UPDATE_COMMENT_PENDING,
  UPDATE_GROUP_TOPIC_PENDING,
  UPDATE_POST,
  UPDATE_POST_PENDING,
  UPDATE_THREAD_READ_TIME,
  MARK_THREAD_UNREAD,
  MUTE_MESSAGE_THREAD,
  UNMUTE_MESSAGE_THREAD,
  UPDATE_USER_SETTINGS_PENDING as UPDATE_USER_SETTINGS_GLOBAL_PENDING,
  UPDATE_WIDGET,
  USE_INVITATION,
  UPDATE_PROPOSAL_OUTCOME_PENDING,
  UPDATE_MEMBERSHIP_NAV_ORDER_PENDING,
  UPDATE_GROUP_VIEW_PENDING,
  UPDATE_GROUP_VIEW_USER,
  UPDATE_GROUP_VIEW_USER_PENDING,
  MARK_VIEW_AS_READ,
  MARK_VIEW_AS_READ_PENDING,
  MARK_GROUP_AS_READ_PENDING,
  UPDATE_SPACE_PENDING
} from 'store/constants'
import {
  UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING,
  UPDATE_MEMBERSHIP_SETTINGS_PENDING,
  UPDATE_USER_SETTINGS_PENDING
} from 'routes/UserSettings/UserSettings.store'

// FIXME these should not be using different constants and getting handled in
// different places -- they're doing the same thing!
import {
  REMOVE_SKILL_PENDING, ADD_SKILL, ADD_SKILL_TO_GROUP, REMOVE_SKILL_FROM_GROUP_PENDING
} from 'components/SkillsSection/SkillsSection.store'
import {
  REMOVE_SKILL_PENDING as REMOVE_SKILL_TO_LEARN_PENDING, ADD_SKILL as ADD_SKILL_TO_LEARN
} from 'components/SkillsToLearnSection/SkillsToLearnSection.store'

import {
  UPDATE_GROUP_SETTINGS,
  UPDATE_GROUP_SETTINGS_PENDING
} from 'routes/GroupSettings/GroupSettings.store'
import {
  CREATE_GROUP
} from 'routes/CreateGroup/CreateGroup.store'
import { JOIN_SPACE } from 'store/actions/joinSpace'
import { FETCH_GROUP_WELCOME_DATA } from 'routes/GroupWelcomeModal/GroupWelcomeModal.store'

import {
  DELETE_GROUP_TOPIC_PENDING
} from 'routes/AllTopics/AllTopics.store'
import {
  INVITE_PEOPLE_TO_EVENT_PENDING
} from 'components/EventInviteDialog/EventInviteDialog.store'
import { FETCH_GROUP_TO_GROUP_JOIN_QUESTIONS } from 'routes/GroupSettings/RelatedGroupsTab/RelatedGroupsTab.store'
import {
  RECEIVE_POST
} from 'components/SocketListener/SocketListener.store'

import orm from 'store/models'
import { DEFAULT_AVATAR } from 'store/models/Group'
import clearCacheFor from './clearCacheFor'
import { find, get, values } from 'lodash/fp'
import extractModelsFromAction from '../ModelExtractor/extractModelsFromAction'
import { isPromise } from 'util/index'
import { applyGroupViewsOrder, appendGroupViewToMenu, preserveViewLoadedPosts, removeGroupViewFromAllMenus, setGroupViewHiddenInAllMenus, syncAcceptedPostTypesInMenus, updateGroupViewInMenu, updateGroupViewInAllMenus } from 'store/util/groupViewsOrder'
import {
  confirmOptimisticChatInNotice,
  reconcileChatActivityNoticesAfterFetch,
  replaceOptimisticChatActivityNotice,
  snapshotChatActivityNotices,
  upsertOptimisticChatActivityNotice
} from 'store/util/chatActivityNotice'
import { groupMenuHasUnreadBadges } from 'util/viewUnreadBadges'

/**
 * Adjust the cached pending join-request count on a Group ORM record.
 */
function adjustOpenJoinRequestCount (session, groupId, delta) {
  if (!groupId || !delta) return
  const group = session.Group.idExists(groupId) ? session.Group.withId(groupId) : null
  if (!group) return
  group.update({ openJoinRequestCount: Math.max(0, (group.openJoinRequestCount || 0) + delta) })
}

/**
 * Whether any loaded menu copy for this group still shows unread (own GroupViews
 * and/or nested under a parent's type=space linkedGroup).
 */
function groupHasUnreadInAnyMenu (session, groupId, getMembershipNewPostCount) {
  const { Group } = session
  const group = Group.idExists(groupId) ? Group.withId(groupId) : null
  if (group && groupMenuHasUnreadBadges(group, getMembershipNewPostCount)) return true

  for (const parent of Group.all().toModelArray()) {
    for (const view of parent.groupViews?.items || []) {
      if (view.type !== 'space' || String(view.linkedGroup?.id) !== String(groupId)) continue
      if (groupMenuHasUnreadBadges(view.linkedGroup, getMembershipNewPostCount)) return true
    }
  }
  return false
}

/**
 * Clear group/space membership badges when the menu has no remaining view or
 * nested-space unread. Also clears parent groups that embed this group as a space.
 */
function clearMembershipIfMenuHasNoUnread (session, groupId) {
  if (!groupId) return
  const { Group, Me, Membership } = session
  const me = Me.first()
  if (!me) return

  const getMembershipNewPostCount = (id) => {
    const membership = Membership.safeGet({ group: id, person: me.id })
    return membership?.newPostCount || 0
  }

  const clearOne = (id) => {
    if (groupHasUnreadInAnyMenu(session, id, getMembershipNewPostCount)) return
    const membership = Membership.safeGet({ group: id, person: me.id })
    if (membership && membership.newPostCount > 0) {
      membership.update({ newPostCount: 0 })
    }
  }

  clearOne(groupId)

  Group.all().toModelArray().forEach(parent => {
    const embedsSpace = (parent.groupViews?.items || []).some(view =>
      view.type === 'space' && String(view.linkedGroup?.id) === String(groupId)
    )
    if (embedsSpace) clearOne(parent.id)
  })
}

/** Plain creator fields so an optimistic pin survives leaving the ORM session. */
function snapshotViewLoadedPostsForFetchGroupViews (Group, meta) {
  const groupId = meta.groupId || meta.graphql?.variables?.groupId
  if (!groupId) return null

  const snapshots = []
  const snapshotGroupViews = (id) => {
    const group = Group.withId(id)
    if (!group?.groupViews?.items?.length) return
    if (snapshots.some(snapshot => String(snapshot.groupId) === String(id))) return
    snapshots.push({
      groupId: id,
      items: structuredClone(group.groupViews.items)
    })
  }

  snapshotGroupViews(groupId)
  Group.withId(groupId)?.groupViews?.items?.forEach(view => {
    if (view.type === 'space' && view.linkedGroup?.id) {
      snapshotGroupViews(view.linkedGroup.id)
    }
  })

  return snapshots.length ? snapshots : null
}

function restoreViewLoadedPostsAfterFetchGroupViews (Group, snapshots) {
  snapshots.forEach(({ groupId, items: existingItems }) => {
    const updatedGroup = Group.withId(groupId)
    if (!updatedGroup?.groupViews?.items) return
    const mergedItems = preserveViewLoadedPosts(existingItems, updatedGroup.groupViews.items)
    updatedGroup.update({ groupViews: { items: structuredClone(mergedItems) } })
  })
}

function snapshotPinnedPost (post) {
  if (!post) return post
  const creator = post.creator?.ref || post.creator
  return {
    ...post,
    creator: creator
      ? { id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl }
      : post.creator
  }
}

export default function ormReducer (state = orm.getEmptyState(), action) {
  const session = orm.session(state)
  const { payload, type, meta, error } = action
  if (error) return state

  const {
    Comment,
    Draft,
    EventInvitation,
    Group,
    GroupRelationship,
    GroupRelationshipInvite,
    GroupTopic,
    Invitation,
    JoinRequest,
    Me,
    Membership,
    Message,
    MessageThread,
    Person,
    Post,
    PostCommenter,
    ProjectMember,
    Skill,
    Topic
  } = session

  if (payload && !isPromise(payload) && meta && meta.extractModel) {
    if (type === FETCH_MY_DRAFTS && meta.replaceAllDrafts) {
      Draft.all().toModelArray().forEach(draft => draft.delete())
    }
    const preservedChatActivityNotices = type === FETCH_POSTS
      ? snapshotChatActivityNotices(Post)
      : []
    const preservedViewPostsSnapshots = type === FETCH_GROUP_VIEWS
      ? snapshotViewLoadedPostsForFetchGroupViews(Group, meta)
      : null
    extractModelsFromAction(action, session)
    if (type === FETCH_POSTS) {
      reconcileChatActivityNoticesAfterFetch(session, preservedChatActivityNotices)
    }
    if (preservedViewPostsSnapshots?.length) {
      restoreViewLoadedPostsAfterFetchGroupViews(Group, preservedViewPostsSnapshots)
    }
  }

  let me, membership, group, person, post, comment, groupTopic
  const sameId = (a, b) => String(a || '') === String(b || '')
  const isNil = value => value === null || value === undefined || value === ''
  const matchesDraftContext = (draft, context) => {
    if (context.type && draft.type !== context.type) return false

    if (context.type === 'post') {
      const draftIsEdit = !!draft.isEdit
      if (!!context.isEdit !== draftIsEdit) return false
      if (draftIsEdit) return sameId(draft.postId, context.postId)
      if (!sameId(draft.groupId, context.groupId)) return false
      if (isNil(context.topicId)) return isNil(draft.topicId)
      if (!sameId(draft.topicId, context.topicId)) return false
      if (context.postType) return draft.postType === context.postType
      return isNil(draft.postType)
    }

    if (context.type === 'comment') return sameId(draft.postId, context.postId)
    if (context.type === 'message') return sameId(draft.messageThreadId, context.messageThreadId)
    return false
  }

  switch (type) {
    case ACCEPT_GROUP_RELATIONSHIP_INVITE: {
      const newGroupRelationship = payload.data.acceptGroupRelationshipInvite.groupRelationship
      if (newGroupRelationship) {
        const { childGroup: childGroupData, parentGroup: parentGroupData, relationshipType } = newGroupRelationship
        const childGroupModel = Group.withId(childGroupData.id)
        const parentGroupModel = Group.withId(parentGroupData.id)

        if (relationshipType === 1) {
          // Peer-to-peer relationship: add each group to the other's peerGroups
          parentGroupModel.updateAppending({ peerGroups: [childGroupModel] })
          childGroupModel.updateAppending({ peerGroups: [parentGroupModel] })
          clearCacheFor(Group, childGroupData.id)
          clearCacheFor(Group, parentGroupData.id)
        } else {
          // Parent-child relationship (relationshipType === 0): existing behavior
          parentGroupModel.updateAppending({ childGroups: [childGroupModel] })
          clearCacheFor(Group, childGroupData.id)
        }

        GroupRelationshipInvite.withId(meta.id).delete()
      }
      break
    }

    case ADD_PROPOSAL_VOTE_PENDING: {
      me = Me.first()
      const optionId = meta.optionId
      const postId = meta.postId
      post = session.Post.withId(postId)

      const optimisticUpdate = { proposalVotes: { ...post.proposalVotes, items: [...post.proposalVotes.items, { postId, optionId, user: me }] } }
      post.update(optimisticUpdate)
      break
    }

    case ADD_SKILL: {
      const skill = payload.data.addSkill
      person = Person.withId(Me.first().id)
      person.updateAppending({ skills: [Skill.create(skill)] })
      me = Me.first()
      me.updateAppending({ skills: [Skill.create(skill)] })
      break
    }

    case ADD_SKILL_TO_GROUP: {
      const skill = payload.data.addSuggestedSkillToGroup
      group = Group.withId(meta.groupId)
      group.updateAppending({ suggestedSkills: [Skill.create(skill)] })
      clearCacheFor(Group, meta.groupId)
      break
    }

    case ADD_SKILL_TO_LEARN: {
      const skillToLearn = payload.data.addSkillToLearn
      person = Person.withId(Me.first().id)
      person.updateAppending({ skillsToLearn: [Skill.create(skillToLearn)] })
      break
    }

    case CANCEL_GROUP_RELATIONSHIP_INVITE:
    case REJECT_GROUP_RELATIONSHIP_INVITE: {
      const invite = GroupRelationshipInvite.withId(meta.id)
      invite.delete()
      break
    }

    case CLEAR_MODERATION_ACTION_PENDING: {
      if (meta && meta?.moderationActionId) {
        const moderationAction = session.ModerationAction.withId(meta.moderationActionId)
        moderationAction.update({ status: 'cleared' })
      }
      break
    }

    case CREATE_COMMENT: {
      Comment.withId(meta.tempId).delete()
      if (!PostCommenter.safeGet({ post: meta.postId, commenter: Me.first().id })) {
        PostCommenter.create({ post: meta.postId, commenter: Me.first().id })
        // we can assume the following because the backend returns the results pre-sorted
        // with the currentUser at the beginning
        const p = Post.withId(meta.postId)
        p.update({ commentersTotal: p.commentersTotal + 1 }) // TODO: this should only update if we're a new commenter
        p.update({ commentsTotal: p.commentsTotal + 1 })
      }
      Draft.all().toModelArray()
        .filter(d => matchesDraftContext(d, { type: 'comment', postId: meta.postId }))
        .forEach(d => d.delete())
      break
    }

    case CREATE_COMMENT_PENDING: {
      Comment.create({
        id: meta.tempId,
        post: meta.postId,
        text: meta.text,
        creator: Me.first().id
      })
      // Mark post as complete if the completion action is to comment
      const post = Post.withId(meta.postId)
      if (post.completionAction === 'comment') {
        post.update({ completedAt: new Date().toISOString(), completionResponse: [meta.text] })
      }
      break
    }

    case CREATE_GROUP: {
      me = Me.withId(Me.first().id)
      const createGroupData = payload.data.createGroup
      const membershipData = createGroupData.memberships.items[0]

      me.updateAppending({
        memberships: [membershipData.id]
      })

      const group = Group.withId(createGroupData.id)
      if (group) {
        group.update({
          avatarUrl: createGroupData.avatarUrl || DEFAULT_AVATAR
        })
      }

      const membership = Membership.withId(membershipData.id)
      if (membership) {
        membership.update({
          navOrder: membershipData.navOrder ?? null,
          newPostCount: membershipData.newPostCount ?? 0
        })
      }

      const coordinatorRole = createGroupData.groupRoles?.items?.find(role => role.name === 'Coordinator')
      if (coordinatorRole) {
        const roleWithGroupId = coordinatorRole.groupId
          ? coordinatorRole
          : { ...coordinatorRole, groupId: createGroupData.id }
        const existingItems = me.groupRoles?.items || []
        const alreadyHasRole = existingItems.some(
          role => role.groupId === roleWithGroupId.groupId && role.name === 'Coordinator'
        )
        if (!alreadyHasRole) {
          me.update({
            groupRoles: {
              ...me.groupRoles,
              items: [...existingItems, roleWithGroupId]
            }
          })
        }
      }

      clearCacheFor(Me, me.id)
      break
    }

    case JOIN_SPACE: {
      me = Me.first()
      const membershipId = payload?.data?.joinSpace?.id
      if (me && membershipId) {
        me.updateAppending({ memberships: [membershipId] })
        clearCacheFor(Me, me.id)
      }
      break
    }

    case CREATE_JOIN_REQUEST: {
      if (payload.data.createJoinRequest.request) {
        me = Me.first()
        const jr = JoinRequest.create({ group: meta.groupId, user: me.id, status: payload.data.createJoinRequest.request.status })
        me.updateAppending({ joinRequests: [jr] })
        adjustOpenJoinRequestCount(session, meta.groupId, 1)
      }
      break
    }

    case ACCEPT_JOIN_REQUEST:
    case DECLINE_JOIN_REQUEST:
      adjustOpenJoinRequestCount(session, meta.groupId, -1)
      break

    case CANCEL_JOIN_REQUEST: {
      const canceledRequest = JoinRequest.idExists(meta.id) ? JoinRequest.withId(meta.id) : null
      adjustOpenJoinRequestCount(session, canceledRequest?.group?.id, -1)
      break
    }

    case CREATE_MESSAGE: {
      Message.withId(meta.tempId).delete()
      const message = payload.data.createMessage
      MessageThread.withId(message.messageThread.id).newMessageReceived()
      Draft.all().toModelArray()
        .filter(d => matchesDraftContext(d, { type: 'message', messageThreadId: message.messageThread.id }))
        .forEach(d => d.delete())
      break
    }

    case CREATE_MESSAGE_PENDING: {
      Message.create({
        id: meta.tempId,
        messageThread: meta.messageThreadId,
        text: meta.text,
        createdAt: new Date().toString(),
        creator: Me.first().id
      })
      break
    }

    case CREATE_MODERATION_ACTION_PENDING: {
      if (meta.data) {
        post = Post.withId(meta?.data?.postId)
        if (post) {
          const flaggedGroups = post.flaggedGroups
          if (flaggedGroups) post.flaggedGroups.push(meta?.data?.groupId)
          const moderationActions = post.moderationActions
          if (moderationActions) post.moderationActions.unshift(meta?.data)
          post.update({ flaggedGroups: flaggedGroups || [meta?.data?.groupId] })
          post.update({ moderationActions: moderationActions || [meta?.data] })
        }

        if (meta.tempId) {
          const reporter = Me.first()
          const actionGroup = Group.withId(meta.data.groupId)
          const creator = post?.creator
          session.ModerationAction.create({
            id: meta.tempId,
            postId: meta.data.postId,
            groupId: meta.data.groupId,
            status: 'active',
            text: meta.data.text,
            anonymous: meta.data.anonymous,
            createdAt: new Date().toISOString(),
            group: actionGroup
              ? {
                  id: actionGroup.id,
                  name: actionGroup.name,
                  slug: actionGroup.slug,
                  avatarUrl: actionGroup.avatarUrl,
                  icon: actionGroup.icon,
                  type: actionGroup.type,
                  parentId: actionGroup.parentId
                }
              : null,
            post: post
              ? {
                  id: post.id,
                  title: post.title,
                  details: post.details,
                  type: post.type,
                  creator: creator
                    ? { id: creator.id, name: creator.name, avatarUrl: creator.avatarUrl }
                    : null,
                  groups: [{ id: meta.data.groupId }],
                  flaggedGroups: post.flaggedGroups
                }
              : { id: meta.data.postId },
            reporter: reporter
              ? { id: reporter.id, name: reporter.name, avatarUrl: reporter.avatarUrl }
              : null,
            agreements: (meta.data.agreements || []).map(id => {
              const agreement = session.Agreement.withId(id)
              return agreement
                ? { id: agreement.id, description: agreement.description, order: agreement.order, title: agreement.title }
                : { id }
            }),
            platformAgreements: (meta.data.platformAgreements || []).map(id => ({ id }))
          })
        }
      }
      break
    }

    case CREATE_MODERATION_ACTION: {
      const created = payload?.data?.createModerationAction
      if (!created?.id || !meta.tempId || String(created.id) === String(meta.tempId)) break
      const temp = session.ModerationAction.withId(meta.tempId)
      if (!temp) break
      const attrs = { ...temp.ref, id: created.id }
      temp.delete()
      session.ModerationAction.create(attrs)
      break
    }

    case CREATE_PROJECT_PENDING:
    case CREATE_POST_PENDING: {
      const postType = meta?.type
      if (!postType) break

      if (postType === 'chat') {
        const chatGroupId = Array.isArray(meta.groupIds) ? meta.groupIds[0] : meta.groupId
        const chatGroup = Group.withId(chatGroupId)
        const chatView = chatGroup?.groupViews?.items?.find(view => view.type === 'chat')
        if (chatGroup && chatView?.id) {
          updateGroupViewInMenu(chatGroup, chatView.id, { newPostCount: 0 })
        }
        const variables = meta.graphql?.variables || {}
        const me = Me.first()
        upsertOptimisticChatActivityNotice(session, {
          groupId: chatGroupId,
          chat: {
            id: variables.localId,
            details: variables.details,
            createdAt: new Date().toISOString(),
            creator: me
          }
        })
        break
      }

      break
    }

    case CREATE_POST: {
      const createdPost = payload?.data?.createPost
      if (!createdPost) break
      const createdType = createdPost.type
      const createdGroupId = createdPost.groups?.[0]?.id || meta?.groupIds?.[0] || meta?.groupId
      const createdTopicId = createdType === 'chat' ? createdPost.topics?.[0]?.id : null

      Draft.all().toModelArray()
        .filter(d => matchesDraftContext(d, {
          type: 'post',
          groupId: createdGroupId,
          topicId: createdTopicId,
          postType: createdType,
          isEdit: false
        }))
        .forEach(d => d.delete())

      if (createdType === 'chat' && createdPost.id && createdGroupId) {
        const createdGroup = Group.withId(createdGroupId)
        const chatView = createdGroup?.groupViews?.items?.find(view => view.type === 'chat')
        if (createdGroup && chatView?.id) {
          updateGroupViewInMenu(createdGroup, chatView.id, {
            newPostCount: 0,
            lastReadPostId: createdPost.id
          })
        }
        confirmOptimisticChatInNotice(session, {
          groupId: createdGroupId,
          localId: createdPost.localId,
          chat: {
            id: createdPost.id,
            details: createdPost.details,
            createdAt: createdPost.createdAt,
            creator: createdPost.creator
          }
        })
      }
      break
    }

    case CREATE_GROUP_VIEW: {
      const newView = payload.data.createGroupView
      if (!newView || !meta.groupId) break
      group = Group.withId(meta.groupId)
      appendGroupViewToMenu(group, newView)
      break
    }

    case UPDATE_GROUP_VIEW_PENDING: {
      // Space views also live under parent.groupViews[].linkedGroup.groupViews
      if (!meta.id || !meta.data || Object.keys(meta.data).length === 0) break
      updateGroupViewInAllMenus(Group.all(), meta.id, meta.data)
      break
    }

    case UPDATE_GROUP_VIEW_USER_PENDING: {
      // ChatRoom / ContextMenu read lastReadPostId + badges from embedded menus.
      // Space views are often nested under the parent group's type=space linkedGroup —
      // patch every loaded menu so the badge clears where the user is looking.
      if (!meta.id || !meta.data) break
      updateGroupViewInAllMenus(Group.all(), meta.id, meta.data)
      if ((meta.data.newPostCount ?? 0) === 0) {
        clearMembershipIfMenuHasNoUnread(session, meta.groupId)
      }
      break
    }

    case UPDATE_GROUP_VIEW_USER: {
      const updatedView = payload?.data?.updateGroupViewUser
      if (!updatedView?.id) break
      updateGroupViewInAllMenus(Group.all(), updatedView.id, {
        lastReadPostId: updatedView.lastReadPostId,
        newPostCount: updatedView.newPostCount
      })
      if ((updatedView.newPostCount ?? 0) === 0) {
        clearMembershipIfMenuHasNoUnread(session, meta.groupId)
      }
      break
    }

    case MARK_VIEW_AS_READ_PENDING: {
      if (!meta.id) break
      updateGroupViewInAllMenus(Group.all(), meta.id, { newPostCount: 0 })
      clearMembershipIfMenuHasNoUnread(session, meta.groupId)
      break
    }

    case MARK_VIEW_AS_READ: {
      const readView = payload?.data?.markViewAsRead
      if (!readView?.id) break
      updateGroupViewInAllMenus(Group.all(), readView.id, {
        lastReadPostId: readView.lastReadPostId,
        newPostCount: readView.newPostCount ?? 0
      })
      if ((readView.newPostCount ?? 0) === 0) {
        clearMembershipIfMenuHasNoUnread(session, meta.groupId)
      }
      break
    }

    case MARK_GROUP_AS_READ_PENDING: {
      if (!meta.groupId) break
      group = Group.withId(meta.groupId)
      const me = Me.first()
      if (me) {
        membership = Membership.safeGet({ group: meta.groupId, person: me.id })
        if (membership) membership.update({ newPostCount: 0 })
      }
      const items = group?.groupViews?.items || []
      if (items.length > 0) {
        group.update({
          groupViews: {
            items: structuredClone(items.map(view => ({ ...view, newPostCount: 0 })))
          }
        })
      }
      break
    }

    case UPDATE_SPACE_PENDING: {
      // Typed views are filtered by acceptedPostTypes in live + edit menus — sync
      // the space Group and every nested parent-menu copy immediately on save.
      if (meta.id && meta.acceptedPostTypes !== undefined) {
        syncAcceptedPostTypesInMenus(Group.all(), meta.id, meta.acceptedPostTypes)
      }
      if (meta.groupId && meta.spaceViewId && meta.data && Object.keys(meta.data).length > 0) {
        group = Group.withId(meta.groupId)
        updateGroupViewInMenu(group, meta.spaceViewId, meta.data)
      }
      break
    }

    case DELETE_COMMENT_PENDING: {
      comment = Comment.withId(meta.id)
      comment.delete()
      break
    }

    case DELETE_DRAFT:
    case REMOVE_DRAFT: {
      if (meta?.id && Draft.idExists(meta.id)) {
        Draft.withId(meta.id).delete()
      }
      break
    }

    case REMOVE_DRAFT_BY_CONTEXT: {
      const drafts = Draft.all().toModelArray()
      drafts
        .filter(d => matchesDraftContext(d, meta || {}))
        .forEach(d => d.delete())
      break
    }

    case DELETE_GROUP_VIEW: {
      // Space views also live under parent.groupViews[].linkedGroup.groupViews
      if (!meta.id) break
      removeGroupViewFromAllMenus(Group.all(), meta.id)
      break
    }

    case DELETE_GROUP_RELATIONSHIP: {
      if (payload.data.deleteGroupRelationship.success) {
        const gr = GroupRelationship.safeGet({ parentGroup: meta.parentId, childGroup: meta.childId })
        if (gr) {
          gr.delete()
          clearCacheFor(Group, meta.parentId)
          clearCacheFor(Group, meta.childId)
        } else {
          // Peer-to-peer relationship
          const parentGroup = Group.withId(meta.parentId)
          const childGroup = Group.withId(meta.childId)
          parentGroup.peerGroups.remove(childGroup.id)
          clearCacheFor(Group, parentGroup.id)
        }
      }
      break
    }

    case DELETE_GROUP_TOPIC_PENDING: {
      groupTopic = GroupTopic.withId(meta.id)
      groupTopic.delete()
      break
    }

    case PIN_POST_PENDING: {
      const group = meta.groupId ? Group.withId(meta.groupId) : null
      if (!group || !meta.viewId) break
      const items = group.groupViews?.items || []
      const view = items.find(v => String(v.id) === String(meta.viewId)) ||
        items.flatMap(v => v.linkedGroup?.groupViews?.items || []).find(v => String(v.id) === String(meta.viewId))
      if (!view) break
      const ids = (view.pinnedPostIds || []).map(id => String(id))
      const postId = String(meta.postId)
      const alreadyPinned = ids.includes(postId)
      const nextIds = alreadyPinned
        ? ids.filter(id => id !== postId)
        : [postId, ...ids]
      const nextPosts = alreadyPinned
        ? (view.pinnedPosts || []).filter(p => String(p.id) !== postId)
        : [snapshotPinnedPost(meta.post), ...(view.pinnedPosts || [])].filter(Boolean)
      updateGroupViewInMenu(group, meta.viewId, {
        pinnedPostIds: nextIds,
        pinnedPosts: nextPosts
      })
      break
    }

    case FETCH_VIEW_PINNED_POSTS: {
      const items = payload.data?.group?.groupViews?.items || []
      const targetGroup = Group.withId(meta.groupId)
      if (!targetGroup) break
      items.forEach(viewData => {
        if (viewData?.id != null) {
          updateGroupViewInMenu(targetGroup, viewData.id, {
            pinnedPostIds: viewData.pinnedPostIds,
            pinnedPosts: viewData.pinnedPosts
          })
        }
      })
      break
    }

    case DELETE_POST_PENDING:
      // Posts sourced from a view's raw collectionPosts (e.g. TrackActionsView)
      // aren't normalized into the Post table, so they may not exist here.
      post = Post.idExists(meta.id) ? Post.withId(meta.id) : null
      if (post) {
        if (meta.groupId) {
          const group = Group.withId(meta.groupId)
          removePostFromGroup(post, group)
        }
        post.delete()
      }
      break

    case FETCH_GROUP_DETAILS_PENDING: {
      // Clear out prerequisite groups so they correclty update with latest data
      group = Group.safeGet({ slug: meta.slug })
      if (group) {
        group.update({ prerequisiteGroups: [] })
      }
      break
    }

    case FETCH_GROUP_TO_GROUP_JOIN_QUESTIONS: {
      const memberships = get('data.me.memberships', payload)
      if (memberships) {
        memberships.forEach(m => clearCacheFor(Membership, m.id))
      }
      break
    }

    case FETCH_VIEW_POSTS: {
      const items = payload.data?.group?.groupViews?.items || []
      const targetGroup = Group.withId(meta.groupId)
      if (!targetGroup) break
      items.forEach(viewData => {
        if (viewData?.id != null && viewData.collectionPosts !== undefined) {
          updateGroupViewInMenu(targetGroup, viewData.id, { collectionPosts: viewData.collectionPosts })
        }
      })
      break
    }

    case FETCH_GROUP_WELCOME_DATA: {
      clearCacheFor(Group, meta.id)
      membership = Membership.safeGet({ group: meta.id, person: meta.userId })
      membership && clearCacheFor(Membership, membership.id)
      break
    }

    case FETCH_MESSAGES_PENDING: {
      if (meta.reset) {
        // this is so that after websocket reconnect events, pagination
        // of messages works as expected
        Message.filter({ messageThread: meta.id }).delete()
      }
      break
    }

    case INVITE_CHILD_TO_JOIN_PARENT_GROUP: {
      const newGroupRelationship = payload.data.inviteGroupToJoinParent.groupRelationship
      if (newGroupRelationship) {
        clearCacheFor(Group, newGroupRelationship.parentGroup.id)
        clearCacheFor(Group, newGroupRelationship.childGroup.id)
      } else {
        const newGroupRelationshipInvite = payload.data.inviteGroupToJoinParent.groupRelationshipInvite
        if (newGroupRelationshipInvite) {
          clearCacheFor(Group, newGroupRelationshipInvite.toGroup.id)
          clearCacheFor(Group, newGroupRelationshipInvite.fromGroup.id)
        }
      }
      break
    }

    case INVITE_PEER_RELATIONSHIP: {
      const newGroupRelationship = payload.data.invitePeerRelationship.groupRelationship
      if (newGroupRelationship) {
        const childGroup = Group.withId(newGroupRelationship.childGroup.id)
        const parentGroup = Group.withId(newGroupRelationship.parentGroup.id)
        parentGroup.update({ peerGroups: [...parentGroup.peerGroups.toModelArray(), childGroup.id] })
        clearCacheFor(Group, parentGroup.id)
      } else {
        const newGroupRelationshipInvite = payload.data.invitePeerRelationship.groupRelationshipInvite
        if (newGroupRelationshipInvite) {
          clearCacheFor(Group, newGroupRelationshipInvite.toGroup.id)
          clearCacheFor(Group, newGroupRelationshipInvite.fromGroup.id)
        }
      }
      break
    }

    case INVITE_PEOPLE_TO_EVENT_PENDING: {
      meta.inviteeIds.forEach(inviteeId => {
        const alreadyInvited = EventInvitation.all()
          .toModelArray()
          .some(ei =>
            sameId(ei.event?.id ?? ei.event, meta.eventId) &&
            sameId(ei.person?.id ?? ei.person, inviteeId)
          )
        if (!alreadyInvited) {
          EventInvitation.create({
            event: meta.eventId,
            person: inviteeId
          })
        }
      })
      clearCacheFor(Post, meta.eventId)
      break
    }

    case JOIN_PROJECT_PENDING: {
      me = Me.first()
      ProjectMember.create({ post: meta.id, member: me.id })
      clearCacheFor(Post, meta.id)
      break
    }

    case LEAVE_GROUP: {
      me = Me.first()
      membership = find(m => m.group.id === meta.id, me.memberships.toModelArray())
      if (membership) membership.delete()
      membership = Membership.safeGet({ group: meta.id, person: me.id })
      if (membership) membership.delete()
      break
    }

    case LEAVE_PROJECT_PENDING: {
      me = Me.first()
      const projectMember = find(
        m => String(m.member.id) === String(me.id) && String(m.post.id) === String(meta.id),
        ProjectMember.all().toModelArray()
      )
      if (projectMember) {
        projectMember.delete()
        clearCacheFor(Post, meta.id)
      }
      break
    }

    case PROCESS_STRIPE_TOKEN_PENDING: {
      post = Post.withId(meta.postId)
      const totalContributions = Number(post.totalContributions) + Number(meta.amount)
      post.update({
        totalContributions
      })
      break
    }

    case RECEIVE_POST: {
      if (payload.data?.post?.type === 'chat_activity') {
        replaceOptimisticChatActivityNotice(session, payload.data.post)
        break
      }
      const post = Post.withId(payload.data?.post?.id)
      if (post) {
        post.groups.toModelArray().forEach(g => {
          const group = Group.withId(g.id)
          if (!group) return
          post.topics.toModelArray().forEach(t => {
            const topic = Topic.withId(t.id)
            if (!topic) return
            const groupTopic = topic.groupTopics.filter({ group: group.id }).first()
            if (!groupTopic) return
            groupTopic.update({ postsTotal: groupTopic.postsTotal + 1 })
          })
        })
      }
      break
    }

    case REMOVE_SKILL_FROM_GROUP_PENDING: {
      group = Group.withId(meta.groupId)
      group.suggestedSkills.remove(meta.skillId)
      clearCacheFor(Group, meta.groupId)
      break
    }

    case REMOVE_POST_PENDING: {
      post = Post.withId(meta.postId)
      const groups = post.groups.filter(c =>
        c.slug !== meta.slug).toModelArray()
      post.update({ groups })
      const group = Group.safeGet({ slug: meta.slug })
      removePostFromGroup(post, group)
      break
    }

    case REMOVE_SKILL_PENDING: {
      // Remove from the Me object and the Person object to be safe, catch in case they dont exist there
      try {
        person = Person.withId(Me.first().id)
        person.skills.remove(meta.skillId)
      } catch (e) {}
      try {
        me = Me.first()
        me.skills.remove(meta.skillId)
      } catch (e) {}
      break
    }

    case REMOVE_SKILL_TO_LEARN_PENDING: {
      person = Person.withId(Me.first().id)
      person.skillsToLearn.remove(meta.skillId)
      break
    }

    case REMOVE_PROPOSAL_VOTE_PENDING: {
      me = Me.first()
      const userId = me.id
      const optionId = meta.optionId
      const postId = meta.postId
      post = session.Post.withId(postId)
      const voteIndex = post.proposalVotes.items.findIndex(vote => vote?.user?.id === userId && vote.optionId === optionId)
      const newProposalVotes = [...post.proposalVotes.items]
      newProposalVotes.splice(voteIndex, 1)
      const proposalVotes = { ...post.proposalVotes, items: newProposalVotes }
      post.update({ proposalVotes })
      break
    }

    case REQUEST_FOR_CHILD_TO_JOIN_PARENT_GROUP: {
      const newGroupRelationship = payload.data.requestToAddGroupToParent.groupRelationship
      if (newGroupRelationship) {
        clearCacheFor(Group, newGroupRelationship.parentGroup.id)
        clearCacheFor(Group, newGroupRelationship.childGroup.id)
      } else {
        const newGroupRelationshipInvite = payload.data.requestToAddGroupToParent.groupRelationshipInvite
        if (newGroupRelationshipInvite) {
          clearCacheFor(Group, newGroupRelationshipInvite.toGroup.id)
          clearCacheFor(Group, newGroupRelationshipInvite.fromGroup.id)
        }
      }
      break
    }

    case RESET_NEW_POST_COUNT_PENDING: {
      if (meta.type === 'Membership') {
        me = Me.first()
        const membership = Membership.safeGet({ group: meta.id, person: me.id })
        membership && membership.update({ newPostCount: meta.count })
      }
      break
    }

    case RESPOND_TO_EVENT_PENDING: {
      const event = Post.withId(meta.id)
      event.update({ myEventResponse: meta.response })
      break
    }

    case SWAP_PROPOSAL_VOTE_PENDING: {
      me = Me.first()
      const userId = me.id
      const addOptionId = meta.addOptionId
      const removeOptionId = meta.removeOptionId
      const postId = meta.postId
      post = session.Post.withId(postId)
      const voteIndex = post.proposalVotes.items.findIndex(vote => vote.user.id === userId && vote.optionId === removeOptionId)
      const newProposalVotes = [...post.proposalVotes.items]
      newProposalVotes[voteIndex] = { postId, optionId: addOptionId, user: me }
      const proposalVotes = { ...post.proposalVotes, items: newProposalVotes }
      post.update({ proposalVotes })
      break
    }

    case TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING: {
      groupTopic = GroupTopic.get({ topic: meta.topicId, group: meta.groupId })
      groupTopic.update({
        followersTotal: groupTopic.followersTotal + (meta.isSubscribing ? 1 : -1),
        isSubscribed: !!meta.isSubscribing
      })
      break
    }

    case UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING: {
      const memberships = session.Membership.all()
      memberships.toModelArray().forEach(membership => {
        membership.update({
          settings: {
            ...membership.settings,
            ...meta.settings
          }
        })
      })
      break
    }

    case UPDATE_COMMENT_PENDING: {
      comment = Comment.withId(meta.id)
      if (comment) comment.update(meta.data)
      const message = Message.withId(meta.id)
      if (message) message.update(meta.data)
      break
    }

    case REORDER_GROUP_VIEW_PENDING: {
      if (!meta.parentGroupId || !meta.targetGroupId || !meta.reorderedItems) break
      group = Group.withId(meta.parentGroupId)
      applyGroupViewsOrder({
        group,
        parentGroupId: meta.parentGroupId,
        targetGroupId: meta.targetGroupId,
        reorderedItems: meta.reorderedItems
      })
      break
    }

    case SET_GROUP_VIEW_HIDDEN_PENDING: {
      // ContextMenu expanded spaces read parent.groupViews[].linkedGroup.groupViews —
      // patch every loaded menu copy, not only the space Group record.
      if (!meta.id || typeof meta.hidden !== 'boolean') break
      setGroupViewHiddenInAllMenus(Group.all(), meta.id, meta.hidden)
      break
    }

    case SET_HOME_VIEW_PENDING: {
      if (!meta.parentGroupId || !meta.targetGroupId || !meta.reorderedItems) break
      group = Group.withId(meta.parentGroupId)
      applyGroupViewsOrder({
        group,
        parentGroupId: meta.parentGroupId,
        targetGroupId: meta.targetGroupId,
        reorderedItems: meta.reorderedItems,
        updateHomeRoute: String(meta.parentGroupId) === String(meta.targetGroupId)
      })
      break
    }

    case UPDATE_GROUP_SETTINGS: {
      // Set new join questions in the ORM
      if (payload.data.updateGroupSettings && (payload.data.updateGroupSettings.joinQuestions || payload.data.updateGroupSettings.prerequisiteGroups)) {
        group = Group.withId(meta.id)
        if (group) clearCacheFor(Group, meta.id)
      }

      // Optimistically update the agreementsAcceptedAt setting, so the person adding the agreements doesnt have to immediately accept them.
      // The query always returns agreements, so only do this when they were actually edited.
      if (meta.changes?.agreements) {
        me = Me.first()
        membership = me ? Membership.safeGet({ group: meta.id, person: me.id }) : null
        if (membership) {
          membership.update({
            settings: {
              ...membership.settings,
              agreementsAcceptedAt: new Date()
            }
          })
        }

        group = Group.withId(meta.id)
        if (group) clearCacheFor(Group, meta.id)
      }
      break
    }

    case UPDATE_GROUP_SETTINGS_PENDING: {
      group = Group.withId(meta.id)
      if (!group) break
      const { settings: settingsChanges, ...otherChanges } = meta.changes || {}
      group.update({
        ...otherChanges,
        ...(settingsChanges
          ? { settings: { ...group.settings, ...settingsChanges } }
          : {})
      })
      me = Me.first()
      // Clear out prerequisiteGroups so they can be reset when the UPDATE completes
      group.update({ prerequisiteGroups: [] })

      // Triggers an update to redux-orm for the membership. Newly created spaces
      // (e.g. track/funding-round) may not have a membership in the ORM yet.
      membership = me ? Membership.safeGet({ group: meta.id, person: me.id }) : null
      if (membership) membership.update({ forceUpdate: new Date() })
      break
    }

    case UPDATE_GROUP_TOPIC_PENDING: {
      groupTopic = GroupTopic.withId(meta.id)
      groupTopic.update(meta.data)
      clearCacheFor(GroupTopic, meta.id)
      break
    }

    case UPDATE_MEMBERSHIP_SETTINGS_PENDING: {
      me = Me.first()
      membership = Membership.safeGet({ group: meta.groupId, person: me.id })

      const newSettings = {
        ...membership.settings,
        ...meta.settings
      }

      // Do this here as a way to optimistically update the agreementsAcceptedAt setting,
      // without actually passing it to the server since that will be set auomatically on the back-end
      if (meta.acceptAgreements) {
        newSettings.agreementsAcceptedAt = new Date()
      }

      if (!membership) break
      membership.update({
        settings: newSettings
      })
      break
    }

    case UPDATE_MEMBERSHIP_NAV_ORDER_PENDING: {
      me = Me.first()
      membership = Membership.safeGet({ group: meta.groupId, person: me.id })

      if (!membership) break

      const newNavOrder = meta.navOrder

      if (newNavOrder === null) {
        // Unpinning - just update this membership
        membership.update({
          navOrder: null
        })
      } else {
        // Check if this is a new pin or reorder
        const currentNavOrder = membership.navOrder
        const isNewPin = currentNavOrder === null

        if (isNewPin) {
          // Pinning a new group - increment all other pinned memberships
          const allMemberships = session.Membership.all().toModelArray()
          const otherPinnedMemberships = allMemberships.filter(m =>
            m.group.id !== meta.groupId && m.navOrder !== null
          )

          // Increment navOrder of all other pinned groups
          otherPinnedMemberships.forEach(m => {
            m.update({
              navOrder: m.navOrder + 1
            })
          })

          // Set this group's navOrder to 0
          membership.update({
            navOrder: 0
          })
        } else {
          // Reordering - handle moving up or down
          const currentNavOrder = membership.navOrder

          if (newNavOrder > currentNavOrder) {
            // Moving down - decrement groups between current+1 and newNavOrder
            const allMemberships = session.Membership.all().toModelArray()
            const groupsToDecrement = allMemberships.filter(m =>
              m.group.id !== meta.groupId &&
              m.navOrder !== null &&
              m.navOrder > currentNavOrder &&
              m.navOrder <= newNavOrder
            )

            groupsToDecrement.forEach(m => {
              m.update({
                navOrder: m.navOrder - 1
              })
            })
          } else if (newNavOrder < currentNavOrder) {
            // Moving up - increment groups between newNavOrder and current-1
            const allMemberships = session.Membership.all().toModelArray()
            const groupsToIncrement = allMemberships.filter(m =>
              m.group.id !== meta.groupId &&
              m.navOrder !== null &&
              m.navOrder >= newNavOrder &&
              m.navOrder < currentNavOrder
            )

            groupsToIncrement.forEach(m => {
              m.update({
                navOrder: m.navOrder + 1
              })
            })
          }
          // If newNavOrder === currentNavOrder, no changes needed

          // Set this group's navOrder
          membership.update({
            navOrder: newNavOrder
          })
        }
      }
      break
    }

    case UPDATE_POST: {
      // This is needed right now to make sure posts update in real time on the landing page
      if (payload.data.updatePost.groups) {
        payload.data.updatePost.groups.forEach(g => clearCacheFor(Group, g.id))
      }
      break
    }

    case UPDATE_POST_PENDING: {
      // deleting all attachments and removing topics here because we restore them from the result of the UPDATE_POST action
      post = Post.withId(meta.id)
      post.attachments.toModelArray().map(a => a.delete())
      const updates = { ...(meta.data || {}) }
      if (meta.topicNames !== undefined) {
        updates.topics = []
      }
      post.update(updates)
      break
    }

    case UPDATE_THREAD_READ_TIME: {
      me = Me.first()
      me.update({
        unseenThreadCount: Math.max(0, me.unseenThreadCount - 1)
      })
      MessageThread.withId(meta.id).markAsRead()
      break
    }

    case MARK_THREAD_UNREAD: {
      if (payload?.api) {
        const thread = MessageThread.withId(meta.id)
        if (thread && thread.unreadCount === 0) {
          me = Me.first()
          me.update({
            unseenThreadCount: (me.unseenThreadCount || 0) + 1
          })
        }
        thread?.markAsUnread()
      }
      break
    }

    case MUTE_MESSAGE_THREAD: {
      me = Me.first()
      const thread = MessageThread.withId(meta.messageThreadId)
      if (thread?.unreadCount > 0) {
        me.update({
          unseenThreadCount: Math.max(0, (me.unseenThreadCount || 0) - 1)
        })
      }
      thread?.update({ isMuted: true })
      break
    }

    case UNMUTE_MESSAGE_THREAD: {
      MessageThread.withId(meta.messageThreadId)?.update({ isMuted: false })
      break
    }

    case UPDATE_PROPOSAL_OUTCOME_PENDING: {
      post = Post.withId(meta.postId)
      post.update({ proposalOutcome: meta.proposalOutcome })
      break
    }

    case UPDATE_USER_SETTINGS_PENDING:
    case UPDATE_USER_SETTINGS_GLOBAL_PENDING: {
      me = Me.first()
      const changes = {
        ...meta.changes,
        settings: {
          ...me.settings,
          ...meta.changes.settings
        }
      }
      me.update(changes)
      break
    }

    case UPDATE_WIDGET: {
      clearCacheFor(Group, payload.data.updateWidget.group.id)
      break
    }

    case USE_INVITATION: {
      me = Me.first()
      const membership = payload.data?.useInvitation?.membership
      if (me && membership?.id) {
        me.updateAppending({ memberships: [membership.id] })
        clearCacheFor(Me, me.id)
        Invitation.filter({ email: me.email, group: membership.group.id }).delete()
      }
      break
    }

    case RECORD_CLICKTHROUGH_PENDING: {
      post = Post.withId(meta.postId)
      post.update({ clickthrough: true })
      break
    }

    case REACT_ON_COMMENT_PENDING: {
      comment = session.Comment.withId(meta.commentId)
      const emojiFull = meta.data.emojiFull
      me = Me.first()

      const optimisticUpdate = {
        commentReactions: [...(comment.commentReactions || []), { emojiFull, user: { name: me.name, id: me.id } }]
      }

      comment.update(optimisticUpdate)

      break
    }

    case REMOVE_REACT_ON_COMMENT_PENDING: {
      comment = session.Comment.withId(meta.commentId)
      const emojiFull = meta.data.emojiFull
      me = Me.first()
      const commentReactions = comment.commentReactions.filter(reaction => {
        if (reaction.emojiFull === emojiFull && reaction.user.id === me.id) return false
        return true
      })
      comment.update({ commentReactions })
      break
    }

    case REACT_ON_POST_PENDING: {
      post = session.Post.withId(meta.postId)
      const emojiFull = meta.data.emojiFull
      me = Me.first()

      const optimisticUpdate = { postReactions: [...(post.postReactions || []), { emojiFull, user: { name: me.name, id: me.id } }] }

      post.update(optimisticUpdate)

      // Mark post as complete if the completion action is to add a reaction
      if (post.completionAction === 'reaction') {
        post.update({ completedAt: new Date().toISOString(), completionResponse: [emojiFull] })
      }

      break
    }

    case REMOVE_REACT_ON_POST_PENDING: {
      post = session.Post.withId(meta.postId)
      const emojiFull = meta.data.emojiFull
      me = Me.first()
      const postReactions = (post.postReactions || []).filter(reaction => {
        if (reaction.emojiFull === emojiFull && reaction.user.id === me.id) return false
        return true
      })
      post.update({ postReactions })
      break
    }
  }

  values(sessionReducers).forEach(fn => fn(session, action))

  return session.state
}

// XXX: this is ugly, would be better to load these posts through redux-orm "queries" so they update automatically
const removePostFromGroup = (post, group) => {
  if (post && group) {
    if (post.announcement) {
      group.update({ announcements: group.announcements.filter(p => p.id !== post.id).toModelArray() })
    }
    if (post.type === 'request' || post.type === 'offer') {
      group.update({ openOffersAndRequests: group.openOffersAndRequests.filter(p => p.id !== post.id).toModelArray() })
    } else if (post.type === 'event') {
      group.update({ upcomingEvents: group.upcomingEvents.filter(p => p.id !== post.id).toModelArray() })
    } else if (post.type === 'project') {
      group.update({ activeProjects: group.activeProjects.filter(p => p.id !== post.id).toModelArray() })
    }
  }
}
