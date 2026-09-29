// Who gets a group's email digest: the emailed settings page's unsubscribe choices (D35)
import { getRecipients } from '../../../lib/group/digest2/util'
import setup from '../../setup'
import factories from '../../setup/factories'

describe('digest2 getRecipients delivery', () => {
  let group, previousEmailNotificationsEnabled

  const member = async ({ settings = {}, digestFrequency = 'daily', ...attrs } = {}) => {
    const user = await factories.user({ settings, last_active_at: new Date(), ...attrs }).save()
    await group.addMembers([user.id], { settings: { sendEmail: true, digestFrequency } })
    return user
  }

  const recipientIds = async type => (await getRecipients(group.id, type)).map(u => String(u.id)).sort()

  beforeEach(async () => {
    await setup.clearDb()
    previousEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
    process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
    group = await factories.group().save()
  })

  afterEach(() => {
    process.env.EMAIL_NOTIFICATIONS_ENABLED = previousEmailNotificationsEnabled
  })

  describe('unsubscribe choices', () => {
    it("keeps digests for 'digest only' and drops them for 'everything except direct' and 'everything'", async () => {
      const none = await member()
      const digestOnly = await member({ settings: { email_unsubscribe_scope: 'digest_only' } })
      await member({ settings: { email_unsubscribe_scope: 'all_but_direct' } })
      await member({ settings: { email_unsubscribe_scope: 'everything' } })

      expect(await recipientIds('daily')).to.deep.equal([none.id, digestOnly.id].map(String).sort())
    })

    it('applies to weekly digests too', async () => {
      const weekly = await member({ digestFrequency: 'weekly' })
      await member({ digestFrequency: 'weekly', settings: { email_unsubscribe_scope: 'all_but_direct' } })

      expect(await recipientIds('weekly')).to.deep.equal([String(weekly.id)])
    })
  })
})
