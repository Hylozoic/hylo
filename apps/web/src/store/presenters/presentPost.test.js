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

  it('exposes featured video link preview fields from the ORM relation', () => {
    const preview = session.LinkPreview.create({
      id: 'lp-1',
      title: 'A video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      imageUrl: 'thumb.png'
    })
    session.Post.withId(postId).update({
      linkPreview: preview.id,
      linkPreviewFeatured: true
    })
    const result = presentPost(session.Post.withId(postId), groupId)
    expect(result.linkPreviewFeatured).toBe(true)
    expect(result.linkPreview.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result.linkPreview.title).toBe('A video')
  })

  it('resolves locationObject from the Location relation', () => {
    session.Location.create({ id: '99', center: { lat: 37.7, lng: -122.4 } })
    session.Post.withId(postId).update({ locationObject: '99' })
    const result = presentPost(session.Post.withId(postId), groupId)
    expect(result.locationObject).toEqual({ id: '99', center: { lat: 37.7, lng: -122.4 } })
  })

  it('keeps nested GraphQL locationObject from post.ref when present', () => {
    const raw = {
      id: 'raw-1',
      title: 'Raw',
      createdAt: new Date().toISOString(),
      locationObject: { id: '88', center: { lat: 37.8, lng: -122.3 } }
    }
    expect(presentPost(raw, groupId).locationObject).toEqual(raw.locationObject)
  })
})
