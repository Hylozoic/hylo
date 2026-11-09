import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import setupPostAttrs from './setupPostAttrs'

describe('setupPostAttrs', () => {
  let user, group

  before(async () => {
    await setup.clearDb()
    user = await factories.user().save()
    group = await factories.group().save()
    await user.joinGroup(group)
  })

  it('maps meetingLink to meeting_link for events', async () => {
    const startTime = Date.now() + 86400000
    const endTime = startTime + 3600000
    const attrs = await setupPostAttrs(user.id, {
      type: Post.Type.EVENT,
      name: 'Online meetup',
      description: '<p>Join us</p>',
      group_ids: [group.id],
      startTime,
      endTime,
      meetingLink: 'https://zoom.us/j/123456789',
      timezone: 'America/Los_Angeles'
    }, true)

    expect(attrs.meeting_link).to.equal('https://zoom.us/j/123456789')
  })
})
