import orm from 'store/models'
import ormReducer from './index'
/* eslint-disable no-fallthrough */
import {
  DELETE_COMMENT_PENDING,
  FETCH_CURRENT_USER,
  JOIN_PROJECT_PENDING
} from 'store/constants'
import {
  UPDATE_THREAD_READ_TIME_PENDING
} from 'screens/Thread/Thread.store'
import {
  UPDATE_LAST_VIEWED_PENDING
} from 'screens/ThreadList/ThreadList.store'
import {
  CREATE_GROUP
} from 'screens/CreateGroupFlow/CreateGroupFlow.store'
import {
  UPDATE_NEW_NOTIFICATION_COUNT_PENDING
} from 'screens/NotificationsList/NotificationsList.store'

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

describe('DELETE_COMMENT_PENDING', () => {
  let session

  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
    const post = session.Post.create({ id: '1', commentsTotal: 2 })
    session.Comment.create({ id: '3', post })
    session.Comment.create({ id: '10', post })
  })

  it('optimistically deletes a comment', () => {
    const action = {
      type: DELETE_COMMENT_PENDING,
      meta: {
        id: '3'
      }
    }

    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    expect(newSession.Comment.count()).toBe(1)
    expect(newSession.Comment.first().id).toBe('10')
  })

  it('decrements commentsTotal', () => {
    const action = {
      type: DELETE_COMMENT_PENDING,
      meta: {
        id: '3'
      }
    }
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)
    expect(newSession.Post.withId(1).commentsTotal).toBe(1)
  })
})

describe('on UPDATE_LAST_VIEWED_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({
    id: '1',
    unseenThreadCount: 11
  })

  const action = {
    type: UPDATE_LAST_VIEWED_PENDING
  }

  it('sets Me.unseenThreadCount to 0', () => {
    const newSession = orm.session(ormReducer(session.state, action))
    expect(newSession.Me.first().unseenThreadCount).toEqual(0)
  })
})

describe('on UPDATE_NEW_NOTIFICATION_COUNT_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  session.Me.create({
    id: '1',
    newNotificationCount: 11
  })

  const action = {
    type: UPDATE_NEW_NOTIFICATION_COUNT_PENDING
  }

  it('sets Me.newNotificationCount to 0', () => {
    const newSession = orm.session(ormReducer(session.state, action))
    expect(newSession.Me.first().newNotificationCount).toEqual(0)
  })
})

describe('on FETCH_CURRENT_USER', () => {
  const session = orm.session(orm.getEmptyState())
  const id = 123
  const userData = {
    id,
    name: 'Maurice',
    location: 'Spain',
    tagline: 'lalala',
    avatarUrl: 'm.png',
    settings: {
      setting1: 1,
      setting2: 2
    }
  }
  session.Me.create(userData)

  session.Person.create(userData)

  const action = {
    type: FETCH_CURRENT_USER,
    payload: {
      getData: () => userData,
      data: {
        me: userData
      }
    }
  }

  it('creates the Person', () => {
    const newSession = orm.session(ormReducer(session.state, action))
    expect(newSession.Person.withId(id).ref).toMatchSnapshot()
  })
})

describe('on UPDATE_THREAD_READ_TIME_PENDING', () => {
  const session = orm.session(orm.getEmptyState())
  const id = 123

  session.MessageThread.create({
    id,
    lastReadAt: new Date(0)
  })

  const action = {
    type: UPDATE_THREAD_READ_TIME_PENDING,
    meta: {
      id
    }
  }

  it('updates the thread lastReadAt', () => {
    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)

    const thread = newSession.MessageThread.withId(id)
    expect(new Date(thread.lastReadAt).getTime()).toBeGreaterThan(new Date().getTime() - 5000)
  })
})

describe('handles CREATE_GROUP', () => {
  it('should link the new Group to MeMemberships', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const meId = 'meId'
    const groupId = 'groupId'
    const membershipId = 'membershipId'

    session.Me.create({ id: meId })
    session.Group.create({ id: groupId, name: 'group 1' })
    session.Membership.create({ id: membershipId, group: groupId, person: meId })

    const groupData = {
      id: groupId,
      memberships: {
        items: [
          {
            id: membershipId,
            person: { id: meId }
          }
        ]
      }
    }
    const action = {
      type: CREATE_GROUP,
      payload: {
        getData: () => groupData,
        data: {
          createGroup: groupData
        }
      }
    }

    const memberships = session.Me.first().memberships
    expect(memberships.count()).toEqual(0)
    const newSession = orm.session(ormReducer(session.state, action))
    const membershipsAfterAction = newSession.Me.first().memberships
    expect(membershipsAfterAction.count()).toEqual(1)
  })
})

describe('handles JOIN_PROJECT_PENDING', () => {
  it('should add project member', () => {
    const session = orm.mutableSession(orm.getEmptyState())
    const projectMemberId = 'projectMemberId'
    const postId = '10'
    session.Me.create({ id: projectMemberId })
    session.Post.create({
      id: postId,
      type: 'project'
    })
    expect(session.ProjectMember.all().count()).toEqual(0)
    const action = {
      type: JOIN_PROJECT_PENDING,
      meta: {
        id: postId
      }
    }
    const newSession = orm.session(ormReducer(session.state, action))
    expect(newSession.ProjectMember.all().count()).toEqual(1)
  })
})

