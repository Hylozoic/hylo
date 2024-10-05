import {
  ormSessionReducer,
  DELETE_POST_PENDING,
  REMOVE_POST_PENDING,
  PIN_POST_PENDING
} from 'hooks/usePostActionSheet.store'
import orm from 'store/models'
import ormReducer from 'store/reducers/ormReducer'

describe('ormSessionReducer', () => {
  let session, group

  beforeEach(() => {
    session = orm.session(orm.getEmptyState())
    group = session.Group.create({ id: 20, slug: 'postheadertest' })
  })

  it('handles DELETE_POST', () => {
    session.Post.create({ id: '1' })

    const action = {
      type: DELETE_POST_PENDING,
      meta: {
        id: 1
      }
    }

    expect(session.Post.idExists('1')).toBeTruthy()
    ormSessionReducer(session, action)
    expect(session.Post.idExists('1')).toBeFalsy()
  })

  it('handles REMOVE_POST', () => {
    session.Post.create({ id: '11', groups: [group] })

    const action = {
      type: REMOVE_POST_PENDING,
      meta: {
        postId: 11,
        slug: 'postheadertest'
      }
    }

    expect(session.Post.withId(11).groups.toRefArray()).toHaveLength(1)
    ormSessionReducer(session, action)
    expect(session.Post.withId(11).groups.toRefArray()).toHaveLength(0)
  })

  it('handles PIN_POST_PENDING', () => {
    const postMembership = session.PostMembership.create({
      pinned: false,
      group
    })
    const postId = 123

    session.Post.create({
      id: postId,
      groups: [group],
      postMemberships: [postMembership]
    })

    const action = {
      type: PIN_POST_PENDING,
      meta: {
        postId,
        groupId: group.id
      }
    }

    const newState = ormReducer(session.state, action)
    const newSession = orm.session(newState)

    const newPostMembership = newSession.Post.withId(postId).postMemberships.toModelArray()[0]
    expect(newPostMembership.pinned).toEqual(true)
  })
})
