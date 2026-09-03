import orm from 'store/models' // this initializes redux-orm
import ormReducer from './index'
import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import {
  CREATE_MESSAGE,
  CREATE_MODERATION_ACTION,
  CREATE_MODERATION_ACTION_PENDING,
  DELETE_COMMENT_PENDING,
  DELETE_POST_PENDING,
  FETCH_FOR_GROUP_PENDING,
  FETCH_NOTIFICATIONS,
  MARK_ACTIVITY_READ_PENDING,
  MARK_VIEW_AS_READ,
  MARK_ALL_ACTIVITIES_READ_PENDING,
  TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING,
  UPDATE_COMMENT_PENDING,
  UPDATE_POST_PENDING,
  REACT_ON_POST_PENDING,
  REMOVE_POST_PENDING
} from 'store/constants'
import {
  UPDATE_MEMBERSHIP_SETTINGS_PENDING,
  UPDATE_USER_SETTINGS_PENDING,
  UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING
} from 'routes/UserSettings/UserSettings.store'
import {
  UPDATE_GROUP_SETTINGS,
  UPDATE_GROUP_SETTINGS_PENDING
} from 'routes/GroupSettings/GroupSettings.store'
import {
  CREATE_GROUP
} from 'routes/CreateGroup/CreateGroup.store'
import {
  REMOVE_MEMBER_PENDING
} from 'routes/Members/Members.store'
import {
  DELETE_GROUP_TOPIC_PENDING
} from 'routes/AllTopics/AllTopics.store'

import deep from 'deep-diff'

it('responds to an action with meta.extractModel', () => {
  const state = orm.getEmptyState()

  const action = {
    type: 'whatever',
    payload: {
      data: {
        post: {
          id: '1',
          title: 'Cat on the loose',
          groups: [
            {
              id: '1',
              name: 'Neighborhood'
            }
          ],
          creator: {
            id: '2',
            name: 'Greg'
          }
        }
      }
    },
    meta: {
      extractModel: 'Post'
    }
  }

  const newState = ormReducer(state, action)

  expect(newState).toMatchObject({
    Group: {
      items: ['1'],
      itemsById: { 1: { id: '1', name: 'Neighborhood' } }
    },
    Person: {
      items: ['2'],
      itemsById: { 2: { id: '2', name: 'Greg' } }
    },
    Post: {
      items: ['1'],
      itemsById: { 1: { id: '1', title: 'Cat on the loose', creator: '2' } }
    },
    PostGroups: {
      items: [0],
      itemsById: { 0: { fromPostId: '1', toGroupId: '1', id: 0 } }
    }
  })
})

it('ignores an action with meta.extractModel that is a promise', () => {
  const state = orm.getEmptyState()

  const action = {
    type: 'FOO',
    payload: new Promise(() => {}),
    meta: {
      extractModel: 'Post'
    }
  }

  const newState = ormReducer(state, action)
  expect(newState).toEqual(state)
})

describe('on REACT_ON_POST_PENDING', () => {
  const session = orm.session(orm.getEmptyState())

  session.Post.create({ id: '1', postReactions: [] })
  session.Me.create({ id: '1', name: 'Mary' })

  const state = session.state

  const action = {
    type: REACT_ON_POST_PENDING
  }

  describe('when someone reacts to a post', () => {
    it('optimistically updates state', () => {
      const newState = ormReducer(state, { ...action, meta: { postId: '1', data: { emojiFull: '\uD83D\uDC4D' } } })
      const newSession = orm.session(newState)
      expect(newSession.Post.withId('1').postReactions[0].emojiFull).toEqual('\uD83D\uDC4D')
      expect(newSession.Post.withId('1').postReactions[0].user.name).toEqual('Mary')
    })
  })
})

const makeActivityState = () => {
  const session = orm.session(orm.getEmptyState())

  session.Activity.create({ id: '1', unread: true })
  session.Activity.create({ id: '2', unread: true })

  return session.state
}

describe('on MARK_ACTIVITY_READ_PENDING', () => {
  it('marks the activity read', () => {
    const state = makeActivityState()
    const action = {
      type: MARK_ACTIVITY_READ_PENDING,
      meta: {
        id: '2'
      }
    }
    const newState = ormReducer(state, action)
    expect(deep(state, newState)).toMatchSnapshot()
  })
})

describe('on MARK_ALL_ACTIVITIES_READ_PENDING', () => {
  it('marks the activity read', () => {
    const state = makeActivityState()
    const action = {
      type: MARK_ALL_ACTIVITIES_READ_PENDING
    }

    const newState = ormReducer(state, action)
    expect(deep(state, newState)).toMatchSnapshot()
  })
})

describe('on TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING', () => {
  it('will set isSubscribed to false and decrement followersTotal', () => {
    const session = orm.session(orm.getEmptyState())
    session.Topic.create({ id: '2' })
    session.Group.create({ id: '3' })
    const groupTopic = session.GroupTopic.create({
      id: '1',
      topic: '2',
      group: '3',
      followersTotal: 10,
      isSubscribed: true
    })
    const state = session.state
    const action = {
      ...toggleGroupTopicSubscribe(groupTopic),
      type: TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING
    }
    const newState = ormReducer(state, action)
    expect(deep(state, newState)).toMatchSnapshot()
  })

  it('will set isSubscribed to true and increment followersTotal', () => {
    const session = orm.session(orm.getEmptyState())
    session.Topic.create({ id: '2' })
    session.Group.create({ id: '3' })
    const groupTopic = session.GroupTopic.create({
      id: '1',
      topic: '2',
      group: '3',
      followersTotal: 10
    })
    const state = session.state
    const action = {
      ...toggleGroupTopicSubscribe(groupTopic),
      type: TOGGLE_GROUP_TOPIC_SUBSCRIBE_PENDING
    }
    const newState = ormReducer(state, action)
    expect(deep(state, newState)).toMatchSnapshot()
  })
})

describe('on CREATE_MESSAGE', () => {
  const session = orm.session(orm.getEmptyState())
  session.Message.create({ id: 'temp' })
  session.MessageThread.create({ id: '1' })

  // this would be created by extractModelMiddleware
  session.Message.create({ id: '2' })

  it('replaces the temporary message with a permanent one', () => {
    const action = {
      type: CREATE_MESSAGE,
      payload: {
        data: {
          createMessage: {
            messageThread: {
              id: '1'
            },
            id: '2',
            text: 'hi'
          }
        }
      },
      meta: { tempId: 'temp' }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    expect(newSession.Message.idExists('temp')).toBeFalsy()
    expect(newSession.Message.idExists('2')).toBeTruthy()
    const thread = newSession.MessageThread.withId('1')
    expect(Date.now() - new Date(thread.updatedAt).getTime()).toBeLessThan(1000)
  })
})

describe('on DELETE_POST_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  session.Post.create({ id: '1' })
  session.Post.create({ id: '2' })
  session.Post.create({ id: '3' })

  it('removes the post', () => {
    const action = {
      type: DELETE_POST_PENDING,
      meta: { id: '2' }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    expect(newSession.Post.idExists('2')).toBeFalsy()
    expect(newSession.Post.idExists('1')).toBeTruthy()
  })
})

describe('on REMOVE_POST_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  const group1 = session.Group.create({ id: '1', slug: 'foo' })
  const group2 = session.Group.create({ id: '2', slug: 'bar' })

  session.Post.create({ id: '1', groups: [group1, group2] })
  session.Post.create({ id: '2', groups: [group1, group2] })

  it('removes the post from the group', () => {
    const action = {
      type: REMOVE_POST_PENDING,
      meta: { postId: '1', slug: 'bar' }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)

    const post1Groups = newSession.Post.withId('1').groups.toModelArray()

    expect(post1Groups.length).toEqual(1)
    expect(post1Groups[0].id).toEqual('1')
    expect(newSession.Post.withId('2').groups.toModelArray().length).toEqual(2)
  })
})

describe('on UPDATE_GROUP_SETTINGS_PENDING', () => {
  const id = '1'
  const session = orm.session(orm.getEmptyState())
  const me = session.Me.create({ id: '1' })
  const group = session.Group.create({
    id,
    name: 'Old Name',
    description: 'Old description',
    settings: {
      showWelcomePage: true,
      showSuggestedSkills: true
    }
  })
  session.Membership.create({
    group: group.id,
    person: me.id,
    settings: {
      sendFoo: true,
      sendEmail: false
    }
  })

  it('updates the group settings', () => {
    const name = 'New Name'
    const description = 'New description'
    const action = {
      type: UPDATE_GROUP_SETTINGS_PENDING,
      meta: {
        id,
        changes: {
          name,
          description
        }
      }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const group = newSession.Group.withId(id)
    expect(group.name).toEqual(name)
    expect(group.description).toEqual(description)
  })

  it('merges settings instead of replacing them', () => {
    const action = {
      type: UPDATE_GROUP_SETTINGS_PENDING,
      meta: {
        id,
        changes: {
          settings: {
            showWelcomePage: false
          }
        }
      }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const group = newSession.Group.withId(id)
    expect(group.settings).toEqual({
      showWelcomePage: false,
      showSuggestedSkills: true
    })
  })

  it('updates a newly created space that has no membership in the ORM yet', () => {
    const newSpaceSession = orm.session(orm.getEmptyState())
    newSpaceSession.Me.create({ id: '1' })
    const newSpace = newSpaceSession.Group.create({
      id: '99',
      name: 'New Track Space',
      settings: {}
    })

    const action = {
      type: UPDATE_GROUP_SETTINGS_PENDING,
      meta: {
        id: newSpace.id,
        changes: {
          settings: {
            showWelcomePage: true
          }
        }
      }
    }

    const newState = ormReducer(newSpaceSession.state, action)
    const resultSession = orm.session(newState)
    expect(resultSession.Group.withId('99').settings.showWelcomePage).toEqual(true)
  })
})

describe('on UPDATE_GROUP_SETTINGS', () => {
  it('does not crash when the query returns agreements but the space has no membership yet', () => {
    const newSpaceSession = orm.session(orm.getEmptyState())
    newSpaceSession.Me.create({ id: '1' })
    newSpaceSession.Group.create({
      id: '99',
      name: 'New Track Space',
      settings: { showWelcomePage: true }
    })

    const action = {
      type: UPDATE_GROUP_SETTINGS,
      payload: {
        data: {
          updateGroupSettings: {
            id: '99',
            settings: { showWelcomePage: true },
            agreements: { items: [] }
          }
        }
      },
      meta: {
        id: '99',
        changes: {
          settings: { showWelcomePage: true }
        }
      }
    }

    expect(() => ormReducer(newSpaceSession.state, action)).not.toThrow()
  })
})

describe('on FETCH_NOTIFICATIONS', () => {
  const session = orm.session(orm.getEmptyState())

  session.Me.create({ newNotificationCount: 3 })

  const action = {
    type: FETCH_NOTIFICATIONS,
    meta: {
      resetCount: true
    }
  }

  it('resets new notification count', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)

    expect(newSession.Me.first().newNotificationCount).toEqual(0)
  })
})

describe(' on UPDATE_MEMBERSHIP_SETTINGS_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({ id: 1 })
  const groupId = 3

  session.Membership.create({
    group: groupId,
    person: 1,
    settings: {
      sendFoo: true,
      sendEmail: false
    }
  })

  const action = {
    type: UPDATE_MEMBERSHIP_SETTINGS_PENDING,
    meta: {
      groupId,
      settings: {
        sendEmail: true,
        sendPushNotifications: false
      }
    }
  }

  it('updates membership settings, keeping current settings where unchanged', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const membership = newSession.Membership.safeGet({ group: groupId })
    expect(membership.settings).toEqual({
      sendFoo: true,
      sendEmail: true,
      sendPushNotifications: false
    })
  })
})

describe('on UPDATE_USER_SETTINGS_PENDING', () => {
  const session = orm.session(orm.getEmptyState())

  session.Me.create({
    location: 'original location',
    tagline: 'old tagline',
    settings: {
      dmNotifications: 'both'
    }
  })

  const action = {
    type: UPDATE_USER_SETTINGS_PENDING,
    meta: {
      changes: {
        tagline: 'new tagline',
        settings: {
          commentNotifications: 'email'
        }
      }
    }
  }

  it('updates user, keeping current settings where unchanged', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const me = newSession.Me.first()
    expect(me.location).toEqual('original location')
    expect(me.tagline).toEqual('new tagline')
    expect(me.settings).toEqual({
      dmNotifications: 'both',
      commentNotifications: 'email'
    })
  })
})

describe('on MARK_VIEW_AS_READ', () => {
  const session = orm.session(orm.getEmptyState())
  session.Group.create({
    id: '1',
    slug: 'space',
    groupViews: {
      items: [
        { id: 'discussions-1', type: 'discussions', newPostCount: 4 }
      ]
    }
  })

  it('zeros newPostCount even when the payload still has a stale unread count', () => {
    const newState = ormReducer(session.state, {
      type: MARK_VIEW_AS_READ,
      payload: {
        data: {
          markViewAsRead: {
            id: 'discussions-1',
            lastReadPostId: '99',
            newPostCount: 4
          }
        }
      },
      meta: { id: 'discussions-1', groupId: '1' }
    })
    const group = orm.session(newState).Group.withId('1')
    expect(group.groupViews.items[0].newPostCount).toEqual(0)
    expect(group.groupViews.items[0].lastReadPostId).toEqual('99')
  })
})

describe('on FETCH_FOR_GROUP_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  const me = session.Me.create({ id: '1' })

  const group = session.Group.create({
    id: '1',
    slug: 'foo'
  })

  session.Membership.create({
    id: '2',
    newPostCount: 99,
    group,
    person: me.id
  })

  const action = {
    type: FETCH_FOR_GROUP_PENDING,
    meta: {
      slug: group.slug
    }
  }

  it('clears newPostCount', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const membership = newSession.Membership.withId('2')
    expect(membership.newPostCount).toEqual(0)
  })
})

describe('on DELETE_COMMENT_PENDING', () => {
  const session = orm.session(orm.getEmptyState())

  session.Comment.create({
    id: '1'
  })
  session.Comment.create({
    id: '2'
  })

  const action = {
    type: DELETE_COMMENT_PENDING,
    meta: {
      id: '1'
    }
  }

  it('clears newPostCount', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const comments = newSession.Comment.all().toModelArray()
    expect(comments.length).toEqual(1)
    expect(comments[0].id).toEqual('2')
  })
})

describe('on UPDATE_POST_PENDING', () => {
  const postId = '123'
  const session = orm.session(orm.getEmptyState())

  session.Attachment.create({
    id: '1',
    post: postId
  })

  session.Attachment.create({
    id: '1',
    post: postId
  })

  session.Post.create({
    id: postId
  })

  const action = {
    type: UPDATE_POST_PENDING,
    meta: {
      id: postId
    }
  }

  it('removes attachments', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const attachments = newSession.Post.withId(postId).attachments.toModelArray()
    expect(attachments.length).toEqual(0)
  })

  it('updates post details optimistically', () => {
    const theNewDetails = 'updated chat message'
    session.Post.withId(postId).update({ details: 'old message' })

    const newState = ormReducer(session.state, {
      type: UPDATE_POST_PENDING,
      meta: {
        id: postId,
        data: {
          details: theNewDetails,
          editedAt: '2024-03-01T12:00:00.000Z'
        }
      }
    })
    const newSession = orm.session(newState)
    const post = newSession.Post.withId(postId)
    expect(post.details).toEqual(theNewDetails)
    expect(post.editedAt).toEqual('2024-03-01T12:00:00.000Z')
  })

  it('does not clear topics when topicNames are not being updated', () => {
    const topic = session.Topic.create({ id: 't1', name: 'general' })
    session.Post.withId(postId).update({ topics: [topic.id] })

    const newState = ormReducer(session.state, {
      type: UPDATE_POST_PENDING,
      meta: {
        id: postId,
        data: {
          details: 'updated chat message'
        }
      }
    })
    const newSession = orm.session(newState)
    const post = newSession.Post.withId(postId)
    expect(post.topics.toModelArray().map(t => t.id)).toEqual(['t1'])
  })
})

describe('on CREATE_GROUP', () => {
  const session = orm.session(orm.getEmptyState())
  const group1 = session.Group.create({ id: 'c1' })
  const group2 = session.Group.create({ id: 'c2' })
  const membership = session.Membership.create({ id: 'm1', group: group1.id })
  session.Membership.create({ id: 'm2', group: group2.id })
  session.Me.create({
    id: 1,
    memberships: [membership.id]
  })
  const action = {
    type: CREATE_GROUP,
    payload: {
      data: {
        createGroup: {
          id: 'g2',
          groupRoles: {
            items: [{
              id: 'coord-1',
              name: 'Coordinator',
              groupId: 'g2',
              emoji: '🪄',
              active: true,
              responsibilities: {
                items: [{ id: '1', title: 'Administration', description: '' }]
              }
            }]
          },
          memberships: {
            items: [
              {
                id: 'm2',
                person: {
                  id: 1
                }
              }
            ]
          }
        }
      }
    }
  }

  it('adds a membership to the currentUser', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const currentUser = newSession.Me.first()
    expect(currentUser.memberships.toModelArray()).toHaveLength(2)
  })

  it('adds the coordinator groupRole to the currentUser', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const currentUser = newSession.Me.first()
    expect(currentUser.groupRoles.items).toHaveLength(1)
    expect(currentUser.groupRoles.items[0].name).toBe('Coordinator')
    expect(currentUser.groupRoles.items[0].responsibilities.items[0].title).toBe('Administration')
  })
})

describe('on REMOVE_MEMBER_PENDING', () => {
  it('decrements the member count and removes the member', () => {
    const action = {
      type: REMOVE_MEMBER_PENDING,
      meta: {
        groupId: '3',
        personId: '4'
      }
    }
    const session = orm.session(orm.getEmptyState())
    session.Person.create({ id: '2', name: 'Foo' })
    session.Person.create({ id: '4', name: 'Bar' })
    session.Group.create({ id: '3', memberCount: 8, members: ['2', '4'] })

    const newState = ormReducer(session.state, action)
    const group = orm.session(newState).Group.withId('3')
    expect(group.memberCount).toBe(7)
    const members = group.members.toRefArray()
    expect(members.length).toBe(1)
    expect(members[0].name).toBe('Foo')
  })
})

describe('on DELETE_GROUP_TOPIC_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  session.GroupTopic.create({ id: '1' })
  session.GroupTopic.create({ id: '2' })

  it('removes the GroupTopic', () => {
    const action = {
      type: DELETE_GROUP_TOPIC_PENDING,
      meta: { id: '1' }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    expect(newSession.GroupTopic.idExists('1')).toBeFalsy()
    expect(newSession.GroupTopic.idExists('2')).toBeTruthy()
  })
})

describe('on UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING', () => {
  it('should update all the memberships settings', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const meId = 'meId'
    session.Me.create({ id: meId })
    session.Membership.create({ person: meId, settings: {} })
    session.Membership.create({ person: meId, settings: {} })
    session.Membership.create({ person: meId, settings: {} })

    const action = {
      type: UPDATE_ALL_MEMBERSHIP_SETTINGS_PENDING,
      meta: {
        settings: {
          sendEmail: true
        }
      }
    }

    const newSession = orm.session(ormReducer(session.state, action))
    const membershipsAfterAction = newSession.Membership.all().toModelArray()
    membershipsAfterAction.forEach(membership => {
      expect(membership.settings.sendEmail).toEqual(true)
    })
  })
})

describe('on UPDATE_COMMENT_PENDING', () => {
  const commentId = '123'
  const session = orm.session(orm.getEmptyState())
  const theNewText = 'lalala'
  const editedAt = '2024-03-01T12:00:00.000Z'

  session.Comment.create({
    id: commentId,
    text: 'ufufuf'
  })

  session.Message.create({
    id: commentId,
    text: 'ufufuf'
  })

  const action = {
    type: UPDATE_COMMENT_PENDING,
    meta: {
      id: commentId,
      data: {
        text: theNewText,
        editedAt
      }
    }
  }

  it('updates the text on Comment and Message', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    const comment = newSession.Comment.withId(commentId)
    const message = newSession.Message.withId(commentId)
    expect(comment.text).toEqual(theNewText)
    expect(comment.editedAt).toEqual(editedAt)
    expect(message.text).toEqual(theNewText)
    expect(message.editedAt).toEqual(editedAt)
  })
})

describe('on CREATE_MODERATION_ACTION', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({ id: 'me-1', name: 'Reporter', avatarUrl: 'me.png' })
  session.Person.create({ id: 'author-1', name: 'Author', avatarUrl: 'author.png' })
  session.Group.create({ id: 'g1', name: 'Hylo', slug: 'hylo', type: null })
  session.Agreement.create({ id: 'a1', title: 'Be kind', description: 'Please', order: 1 })
  session.Post.create({
    id: 'p1',
    title: 'Hello',
    details: 'World',
    type: 'discussion',
    creator: 'author-1',
    flaggedGroups: []
  })

  const pendingAction = {
    type: CREATE_MODERATION_ACTION_PENDING,
    meta: {
      tempId: 'temp-mod-1',
      data: {
        postId: 'p1',
        groupId: 'g1',
        text: 'This breaks an agreement',
        anonymous: false,
        agreements: ['a1'],
        platformAgreements: ['plat-1']
      }
    }
  }

  it('creates a renderable optimistic moderation action', () => {
    const newState = ormReducer(session.state, pendingAction)
    const newSession = orm.session(newState)
    const action = newSession.ModerationAction.withId('temp-mod-1')
    expect(action.status).toEqual('active')
    expect(action.text).toEqual('This breaks an agreement')
    expect(action.reporter.name).toEqual('Reporter')
    expect(action.post.title).toEqual('Hello')
    expect(action.post.creator.name).toEqual('Author')
    expect(action.group.slug).toEqual('hylo')
    expect(action.agreements[0].title).toEqual('Be kind')
    expect(action.platformAgreements[0].id).toEqual('plat-1')
    expect(newSession.Post.withId('p1').flaggedGroups).toContain('g1')
  })

  it('replaces the temp id with the server id', () => {
    const pendingState = ormReducer(session.state, pendingAction)
    const newState = ormReducer(pendingState, {
      type: CREATE_MODERATION_ACTION,
      payload: { data: { createModerationAction: { id: 'real-9' } } },
      meta: { tempId: 'temp-mod-1' }
    })
    const newSession = orm.session(newState)
    expect(newSession.ModerationAction.idExists('temp-mod-1')).toBe(false)
    const action = newSession.ModerationAction.withId('real-9')
    expect(action.text).toEqual('This breaks an agreement')
    expect(action.reporter.name).toEqual('Reporter')
  })
})
