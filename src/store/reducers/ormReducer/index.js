import * as sessionReducers from './sessionReducers'
import { values, pick } from 'lodash/fp'
import orm from 'store/models'
import ModelExtractor from '../ModelExtractor'
import extractModelsFromAction from '../ModelExtractor/extractModelsFromAction'
import clearCacheFor from './clearCacheFor'
import { isPromise } from 'util/index'
import {
  UPDATE_GROUP_SETTINGS_PENDING
} from 'screens/GroupSettings/GroupSettings.store'
import {
  UPDATE_USER_SETTINGS_PENDING
} from 'store/actions/updateUserSettings'
import {
  ADD_SKILL, REMOVE_SKILL
} from 'components/SkillEditor/SkillEditor.store'
import {
  CREATE_COMMENT
} from 'screens/PostDetails/CommentEditor/CommentEditor.store'
import {
  SET_TOPIC_SUBSCRIBE_PENDING
} from 'screens/Feed/Feed.store'
import {
  MARK_ACTIVITY_READ, MARK_ALL_ACTIVITIES_READ, UPDATE_NEW_NOTIFICATION_COUNT_PENDING
} from 'screens/NotificationsList/NotificationsList.store'
import {
  CREATE_MESSAGE, CREATE_MESSAGE_PENDING, UPDATE_THREAD_READ_TIME_PENDING
} from 'screens/Thread/Thread.store'
import {
  VOTE_ON_POST_PENDING
} from 'components/PostCard/PostFooter/PostFooter.store'
import {
  USE_INVITATION
} from 'screens/JoinGroup/JoinGroup.store'
import {
  DELETE_COMMENT_PENDING
} from 'components/Comment/Comment.store'
import {
  UPDATE_LAST_VIEWED_PENDING
} from 'screens/ThreadList/ThreadList.store'
import {
  CREATE_GROUP
} from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import {
  UPDATE_MEMBERSHIP_SETTINGS_PENDING, UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING
} from 'screens/NotificationSettings/NotificationSettings.store'
import {
  RESET_NEW_POST_COUNT_PENDING
} from 'store/actions/resetNewPostCount'
import {
  UPDATE_USER_SETTINGS
} from 'screens/SignupFlow/SignupFlow.store'
import {
  FETCH_CURRENT_USER,
  JOIN_PROJECT_PENDING,
  LEAVE_PROJECT_PENDING
} from 'store/constants'
import { PIN_POST_PENDING } from 'components/PostCard/PostHeader/PostHeader.store'

export default function ormReducer (state = {}, action) {
  const session = orm.session(state)
  const { payload, type, meta, error } = action
  if (error) return state

  if (payload && !isPromise(payload) && meta && meta.extractModel) {
    extractModelsFromAction(action, session)
  }

  switch (type) {
    case CREATE_COMMENT: {
      const post = session.Post.safeGet({ id: meta.postId })
      const me = session.Me.first()

      if (!post) break
      post.updateAppending({ commenters: [me.id] })
      post.update({ commentsTotal: (post.commentsTotal || 0) + 1 })

      break
    }

    case CREATE_MESSAGE_PENDING: {
      session.Message.create({
        id: meta.tempId,
        messageThread: meta.messageThreadId,
        text: meta.text,
        createdAt: new Date().toString(),
        creator: session.Me.first().id
      })
      break
    }

    case CREATE_MESSAGE: {
      // remove the temporary message and then create the real one -- we do this
      // here instead of using meta.extractModel so it all happens in a single
      // reduce. we can't just update the temporary message because redux-orm
      // doesn't support updating ID's
      session.Message.withId(meta.tempId).delete()
      ModelExtractor.addAll({
        session,
        root: payload.data.createMessage,
        modelName: 'Message'
      })
      break
    }

    case MARK_ACTIVITY_READ: {
      if (session.Activity.idExists(meta.id)) {
        session.Activity.withId(meta.id).update({ unread: false })
      }
      break
    }

    case MARK_ALL_ACTIVITIES_READ: {
      session?.Activity.all().update({ unread: false })
      break
    }

    case ADD_SKILL: {
      const me = session.Me.first()
      const skill = session.Skill.create(payload.data.addSkill)
      me.updateAppending({ skills: [skill] })
      break
    }

    case REMOVE_SKILL: {
      const me = session.Me.first()
      const skill = session.Skill.safeGet({ name: meta.name })
      if (skill) {
        me.skills.remove(skill.id)
      }
      break
    }

    case VOTE_ON_POST_PENDING: {
      const post = session.Post.withId(meta.postId)
      if (post.myVote) {
        !meta.isUpvote && post.update({ myVote: false, votesTotal: (post.votesTotal || 1) - 1 })
      } else {
        meta.isUpvote && post.update({ myVote: true, votesTotal: (post.votesTotal || 0) + 1 })
      }
      break
    }

    case UPDATE_USER_SETTINGS_PENDING: {
      const me = session.Me.first()
      const changes = {
        ...meta.changes,
        settings: {
          ...me.settings,
          ...meta.changes.settings
        }
      }
      me.update(changes)
      if (session.Person.idExists(me.id)) {
        session.Person.withId(me.id).update(changes)
      }
      break
    }

    case UPDATE_GROUP_SETTINGS_PENDING: {
      const group = session.Group.withId(meta.id)
      group.update(meta.changes)
      const membership = session.Membership.safeGet({ group: meta.id }).update({ forceUpdate: new Date() })
      break
    }

    case SET_TOPIC_SUBSCRIBE_PENDING: {
      const groupTopic = session.GroupTopic.get({
        topic: meta.topicId, group: meta.groupId
      })
      groupTopic.update({
        followersTotal: groupTopic.followersTotal + (meta.isSubscribing ? 1 : -1),
        isSubscribed: !!meta.isSubscribing
      })
      break
    }

    case USE_INVITATION: {
      const me = session.Me.first()
      me.updateAppending({ memberships: [payload.data.useInvitation.membership.id] })
      break
    }

    case DELETE_COMMENT_PENDING: {
      const comment = session.Comment.withId(meta.id)
      const post = comment.post
      post.update({ commentsTotal: post.commentsTotal - 1 })
      comment.delete()
      break
    }

    case UPDATE_LAST_VIEWED_PENDING: {
      const me = session.Me.first()
      me.update({ unseenThreadCount: 0 })
      break
    }

    case UPDATE_NEW_NOTIFICATION_COUNT_PENDING: {
      const me = session.Me.first()
      me.update({ newNotificationCount: 0 })
      break
    }

    case RESET_NEW_POST_COUNT_PENDING: {
      const { id } = meta.graphql.variables
      const membership = session.Membership.safeGet({ group: id })
      if (!membership) break
      membership.update({ newPostCount: 0 })
      break
    }

    case PIN_POST_PENDING: {
      const post = session.Post.withId(meta.postId)
      // this line is to clear the selector memoization
      post.update({ _invalidate: (post._invalidate || 0) + 1 })
      const postMembership = post.postMemberships.filter(p =>
        Number(p.group) === Number(meta.groupId)).toModelArray()[0]
      postMembership && postMembership.update({ pinned: !postMembership.pinned })
      break
    }

    case FETCH_CURRENT_USER: {
      const personId = payload.data?.me?.id
      const attrs = pick(['id', 'avatarUrl', 'name', 'location'], payload.data.me)
      const person = session.Person.safeWithId(personId)
      person
        ? person.update(attrs)
        : session.Person.create(attrs)
      break
    }

    case CREATE_GROUP: {
      const me = session.Me.first()
      me.updateAppending({ memberships: [payload.data.createGroup.id] })
      break
    }

    case JOIN_PROJECT_PENDING: {
      const me = session.Me.first()
      session.ProjectMember.create({ post: meta.id, member: me.id })
      clearCacheFor(session.Post, meta.id)
      break
    }

    case LEAVE_PROJECT_PENDING: {
      const me = session.Me.first()
      session
        .ProjectMember
        .filter(member =>
          String(member.member) === String(me.id) &&
          String(member.post) === String(meta.id)
        )
        .toModelArray()
        .forEach(member => member.delete())
      clearCacheFor(session.Post, meta.id)
      break
    }

    case UPDATE_THREAD_READ_TIME_PENDING: {
      const thread = session.MessageThread.safeWithId(meta.id)
      if (thread) thread.update({ lastReadAt: new Date().toString() })
      break
    }

    case UPDATE_MEMBERSHIP_SETTINGS_PENDING: {
      const membership = session.Membership.safeGet({ group: meta.groupId })
      if (!membership) break
      membership.update({
        settings: {
          ...membership.settings,
          ...meta.settings
        }
      })
      break
    }

    case UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING: {
      const memberships = session.Membership.all()
      memberships.toModelArray().map(membership => {
        membership.update({
          settings: {
            ...membership.settings,
            ...meta.settings
          }
        })
      })
      break
    }
  }

  values(sessionReducers).forEach(fn => fn(session, action))

  return session.state
}
