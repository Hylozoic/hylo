/* eslint-disable no-unused-expressions */
import { pick } from 'lodash'
import setup from '../../setup'
import factories from '../../setup/factories'

const KEYS = ['postNotifications', 'digestFrequency', 'sendEmail', 'sendPushNotifications']
const notificationSettings = async (user, group) =>
  pick((await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()).get('settings'), KEYS)

describe('User#joinGroup notification settings (D1, D11)', () => {
  let group

  before(async () => {
    await setup.clearDb()
    group = await factories.group().save()
  })

  after(() => setup.clearDb())

  it("starts on 'important' and the group's default digest", async () => {
    const user = await factories.user().save()
    await user.joinGroup(group)
    expect(await notificationSettings(user, group)).to.deep.equal({
      postNotifications: 'important', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: true
    })
  })

  it("follows the group's steward-set defaults", async () => {
    const busy = await factories.group({ settings: { default_post_notifications: 'all', default_digest_frequency: 'weekly' } }).save()
    const user = await factories.user().save()
    await user.joinGroup(busy)
    expect(await notificationSettings(user, busy)).to.deep.equal({
      postNotifications: 'all', digestFrequency: 'weekly', sendEmail: true, sendPushNotifications: true
    })
  })

  it('does not reset the settings of someone who is already a member', async () => {
    const user = await factories.user().save()
    await user.joinGroup(group)
    const membership = await GroupMembership.forPair(user, group).fetch()
    membership.addSetting({ postNotifications: 'all', digestFrequency: 'weekly', sendEmail: false })
    await membership.save()

    await user.joinGroup(group)
    expect(await notificationSettings(user, group)).to.deep.equal({
      postNotifications: 'all', digestFrequency: 'weekly', sendEmail: false, sendPushNotifications: true
    })
  })

  it('keeps the settings of someone rejoining after leaving', async () => {
    const user = await factories.user().save()
    await user.joinGroup(group)
    const membership = await GroupMembership.forPair(user, group).fetch()
    membership.addSetting({ postNotifications: 'none', sendPushNotifications: false })
    await membership.save()
    await user.leaveGroup(group)

    await user.joinGroup(group)
    expect(await notificationSettings(user, group)).to.deep.equal({
      postNotifications: 'none', digestFrequency: 'daily', sendEmail: true, sendPushNotifications: false
    })
  })

  it('starts with email off for someone who unsubscribed from group emails', async () => {
    const user = await factories.user({ settings: { email_unsubscribe_scope: 'no_group_emails' } }).save()
    await user.joinGroup(group)
    expect((await notificationSettings(user, group)).sendEmail).to.equal(false)
  })

  it("starts with email and push off after 'Everything', leaving in-app notices on", async () => {
    const user = await factories.user({
      settings: { email_unsubscribe_scope: 'everything', digest_frequency: 'never', post_notifications: 'none', dm_notifications: 'none', comment_notifications: 'none' }
    }).save()
    await user.joinGroup(group)
    expect(await notificationSettings(user, group)).to.deep.equal({
      postNotifications: 'important', digestFrequency: 'daily', sendEmail: false, sendPushNotifications: false
    })
  })

  it('carries over a saved weekly digest', async () => {
    const user = await factories.user({ settings: { digest_frequency: 'weekly' } }).save()
    await user.joinGroup(group)
    expect((await notificationSettings(user, group)).digestFrequency).to.equal('weekly')
  })
})
