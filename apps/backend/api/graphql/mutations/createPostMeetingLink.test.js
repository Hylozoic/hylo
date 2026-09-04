import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createPost } from './post'

describe('createPost meetingLink', () => {
  let user, group

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
    await user.joinGroup(group)
  })

  it('persists meetingLink on event create', async () => {
    const startTime = Date.now() + 86400000
    const endTime = startTime + 3600000
    const meetingLink = 'https://meet.google.com/abc-defg-hij'

    const post = await createPost(user.id, {
      title: 'Hybrid event',
      details: '<p>Details</p>',
      type: Post.Type.EVENT,
      groupIds: [group.id],
      startTime,
      endTime,
      meetingLink,
      timezone: 'America/Los_Angeles'
    })

    const saved = await Post.find(post.id)
    expect(saved.get('meeting_link')).to.equal(meetingLink)
  })
})
