import orm from 'store/models'
import presentPost from './presentPost'

describe('presentPost', () => {
  const groupId = 121
  const postId = 324
  const session = orm.session(orm.getEmptyState())

  session.Group.create({ id: groupId })
  const person = session.Person.create({ name: 'Mr Person' })
  const eventInvitation = session.EventInvitation.create({ response: 'yes', person, event: postId })
  session.Post.create({ id: postId, eventInvitations: [eventInvitation] })

  Date.now = jest.fn(() => new Date(2024, 6, 23, 16, 30))

  it('matches the snapshot', () => {
    const post = session.Post.withId(postId)
    const result = presentPost(post, groupId)
    expect(result).toMatchSnapshot()
  })

  it('keeps nested GraphQL locationObject from post.ref', () => {
    session.Post.withId(postId).update({
      locationObject: { id: '99', center: { lat: 37.7, lng: -122.4 } }
    })
    const result = presentPost(session.Post.withId(postId), groupId)
    expect(result.locationObject).toEqual({ id: '99', center: { lat: 37.7, lng: -122.4 } })
  })
})
