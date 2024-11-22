/* eslint-disable no-fallthrough */
import * as sessionReducers from './sessionReducers'
import {
  ACCEPT_GROUP_RELATIONSHIP_INVITE,
  ADD_PROPOSAL_VOTE_PENDING,
  ADD_SKILL,
  CANCEL_GROUP_RELATIONSHIP_INVITE,
  CANCEL_JOIN_REQUEST,
  DELETE_GROUP_RELATIONSHIP,
  INVITE_CHILD_TO_JOIN_PARENT_GROUP,
  JOIN_PROJECT_PENDING,
  LEAVE_GROUP,
  LEAVE_PROJECT_PENDING,
  REJECT_GROUP_RELATIONSHIP_INVITE,
  REMOVE_MODERATOR_PENDING,
  REMOVE_PROPOSAL_VOTE_PENDING,
  REMOVE_SKILL_PENDING,
  REQUEST_FOR_CHILD_TO_JOIN_PARENT_GROUP,
  SWAP_PROPOSAL_VOTE_PENDING,
  UPDATE_USER_SETTINGS_PENDING as UPDATE_USER_SETTINGS_GLOBAL_PENDING,
  USE_INVITATION,
  CREATE_MODERATION_ACTION_PENDING,
  CLEAR_MODERATION_ACTION_PENDING
} from 'store/constants'
import {
  CREATE_GROUP
} from 'screens/CreateGroupFlow/CreateGroupFlow.store'

import orm from 'store/models'
import clearCacheFor from './clearCacheFor'
import { find, values } from 'lodash/fp'
import extractModelsFromAction from '../ModelExtractor/extractModelsFromAction'
import { isPromise } from 'util/index'
import { UPDATE_MEMBERSHIP_SETTINGS_PENDING } from 'store/actions/updateMembershipSettings'

export default function ormReducer (state = orm.getEmptyState(), action) {
  const session = orm.session(state)
  const { payload, type, meta, error } = action
  if (error) return state

  const {
    Group,
    GroupRelationship,
    GroupRelationshipInvite,
    Invitation,
    JoinRequest,
    Me,
    Membership,
    Person,
    Post,
    ProjectMember,
    Skill
  } = session

  if (payload && !isPromise(payload) && meta && meta.extractModel) {
    extractModelsFromAction(action, session)
  }

  let me, membership, group, person, post, childGroup

  switch (type) {
    case ACCEPT_GROUP_RELATIONSHIP_INVITE: {
      const newGroupRelationship = payload.data.acceptGroupRelationshipInvite.groupRelationship
      if (newGroupRelationship) {
        childGroup = Group.withId(newGroupRelationship.childGroup.id)
        Group.withId(newGroupRelationship.parentGroup.id).updateAppending({ childGroups: [childGroup] })
        GroupRelationshipInvite.withId(meta.id).delete()
        clearCacheFor(Group, childGroup.id)
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

    case CLEAR_MODERATION_ACTION_PENDING: {
      if (meta && meta?.moderationActionId) {
        const moderationAction = session.ModerationAction.withId(meta.moderationActionId)
        moderationAction.update({ status: 'cleared' })
      }
      break
    }

    case CANCEL_GROUP_RELATIONSHIP_INVITE:
    case REJECT_GROUP_RELATIONSHIP_INVITE: {
      const invite = GroupRelationshipInvite.withId(meta.id)
      invite.delete()
      break
    }

    case CANCEL_JOIN_REQUEST: {
      const jr = JoinRequest.withId(meta.id)
      jr.delete()
      break
    }

    case CREATE_GROUP: {
      me = Me.withId(Me.first().id)
      me.updateAppending({ memberships: [payload.data.createGroup.memberships.items[0].id] })
      clearCacheFor(Me, me.id)
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
      }
      break
    }

    case DELETE_GROUP_RELATIONSHIP: {
      if (payload.data.deleteGroupRelationship.success) {
        const gr = GroupRelationship.safeGet({ parentGroup: meta.parentId, childGroup: meta.childId })
        if (gr) {
          gr.delete()
          clearCacheFor(Group, meta.parentId)
          clearCacheFor(Group, meta.childId)
        }
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

    case REMOVE_MODERATOR_PENDING: {
      group = Group.withId(meta.groupId)
      const stewards = group.stewards.filter(m =>
        m.id !== meta.personId)
        .toModelArray()
      group.update({ stewards })
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

    case UPDATE_MEMBERSHIP_SETTINGS_PENDING: {
      me = Me.first()
      membership = Membership.safeGet({ group: meta.groupId, person: me.id })

      if (!membership) break
      membership.update({
        settings: {
          ...membership.settings,
          ...meta.settings
        }
      })
      break
    }

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

    case USE_INVITATION: {
      me = Me.first()
      me.updateAppending({ memberships: [payload.data.useInvitation.membership.id] })
      Invitation.filter({ email: me.email, group: payload.data.useInvitation.membership.group.id }).delete()
      break
    }
  }

  values(sessionReducers).forEach(fn => fn(session, action))

  return session.state
}
