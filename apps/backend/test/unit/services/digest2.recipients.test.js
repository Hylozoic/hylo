// Who gets a group's email digest: members who are away (D9) and the emailed settings
// page's unsubscribe choices (D35)
import { getRecipients } from '../../../lib/group/digest2/util'
import { sendAllDigests, sendToUser } from '../../../lib/group/digest2'
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY)

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

  describe('members who are away (D9)', () => {
    it('moves daily members away 30 to 180 days to the weekly digest', async () => {
      const recent = await member({ last_active_at: daysAgo(3) })
      const away = await member({ last_active_at: daysAgo(45) })
      const weekly = await member({ digestFrequency: 'weekly', last_active_at: daysAgo(45) })

      expect(await recipientIds('daily')).to.deep.equal([String(recent.id)])
      expect(await recipientIds('weekly')).to.deep.equal([away.id, weekly.id].map(String).sort())
    })

    it('sends no digest to members away 180 days or more', async () => {
      await member({ last_active_at: daysAgo(200) })
      await member({ digestFrequency: 'weekly', last_active_at: daysAgo(200) })

      expect(await recipientIds('daily')).to.deep.equal([])
      expect(await recipientIds('weekly')).to.deep.equal([])
    })

    it('uses the signup date for someone who was never active', async () => {
      const newcomer = await member({ last_active_at: null, created_at: daysAgo(2) })
      const lapsed = await member({ last_active_at: null, created_at: daysAgo(60) })

      expect(await recipientIds('daily')).to.deep.equal([String(newcomer.id)])
      expect(await recipientIds('weekly')).to.deep.equal([String(lapsed.id)])
    })

    it('marks only the daily members who were moved to weekly', async () => {
      const away = await member({ last_active_at: daysAgo(45) })
      await member({ digestFrequency: 'weekly', last_active_at: daysAgo(45) })

      const recipients = await getRecipients(group.id, 'weekly')
      expect(recipients.filter(u => u.digestSlowed).map(u => String(u.id))).to.deep.equal([String(away.id)])
    })

    describe('the first slowed-down weekly digest', () => {
      let sends

      beforeEach(() => {
        sends = []
        mockify(Email, 'sendSimpleEmail', (address, templateId, data) => { sends.push(data); return Promise.resolve({ success: true }) })
      })

      afterEach(() => unspyify(Email, 'sendSimpleEmail'))

      const digestData = () => ({
        group_id: group.id,
        group_name: 'Orchard',
        discussions: [{ id: 1, title: 'Hello', user: { id: 0, name: 'Someone' } }]
      })

      it('says once that email was slowed, and remembers it for this absence', async () => {
        const away = await member({ last_active_at: daysAgo(45) })
        const [user] = (await getRecipients(group.id, 'weekly')).filter(u => String(u.id) === String(away.id))

        await sendToUser(user, 'weekly', digestData())
        expect(sends[0].slowed_notice).to.match(/weekly digest/)
        await away.refresh()
        expect(new Date(away.get('settings').digest_slowed_notice_at)).to.be.above(daysAgo(1))

        const [again] = (await getRecipients(group.id, 'weekly')).filter(u => String(u.id) === String(away.id))
        await sendToUser(again, 'weekly', digestData())
        expect(sends[1]).not.to.have.property('slowed_notice')
      })

      it('says it again after a later absence', async () => {
        const away = await member({
          last_active_at: daysAgo(45),
          settings: { digest_slowed_notice_at: daysAgo(120).toISOString() }
        })
        const [user] = (await getRecipients(group.id, 'weekly')).filter(u => String(u.id) === String(away.id))

        await sendToUser(user, 'weekly', digestData())
        expect(sends[0].slowed_notice).to.match(/weekly digest/)
      })

      it('never says it in a daily digest or to weekly members', async () => {
        const weekly = await member({ digestFrequency: 'weekly', last_active_at: daysAgo(45) })
        const [user] = await getRecipients(group.id, 'weekly')
        expect(String(user.id)).to.equal(String(weekly.id))

        await sendToUser(user, 'weekly', digestData())
        expect(sends[0]).not.to.have.property('slowed_notice')
      })

      it('says it in only one of two digests sent at the same time', async () => {
        const away = await member({ last_active_at: daysAgo(45) })
        const second = await factories.group().save()
        await second.addMembers([away.id], { settings: { sendEmail: true, digestFrequency: 'daily' } })
        const [first] = await getRecipients(group.id, 'weekly')
        const [other] = await getRecipients(second.id, 'weekly')

        await Promise.all([
          sendToUser(first, 'weekly', digestData()),
          sendToUser(other, 'weekly', { ...digestData(), group_id: second.id })
        ])
        expect(sends).to.have.length(2)
        expect(sends.filter(data => data.slowed_notice)).to.have.length(1)
      })

      it('says it in the next digest when a send fails', async () => {
        const away = await member({ last_active_at: daysAgo(45) })
        const [user] = (await getRecipients(group.id, 'weekly')).filter(u => String(u.id) === String(away.id))
        unspyify(Email, 'sendSimpleEmail')
        mockify(Email, 'sendSimpleEmail', (address, templateId, data) => { sends.push(data); return Promise.resolve(sends.length > 1 ? { success: true } : false) })

        await sendToUser(user, 'weekly', digestData())
        await sendToUser(user, 'weekly', digestData())
        expect(sends[0].slowed_notice).to.match(/weekly digest/)
        expect(sends[1].slowed_notice).to.match(/weekly digest/)
      })
    })
  })

  describe('what a one-click unsubscribe from a digest switches off (D34)', () => {
    let calls

    beforeEach(() => {
      calls = []
      mockify(Email, 'sendSimpleEmail', (address, templateId, data, extraOptions) => {
        calls.push({ address, data, extraOptions })
        return Promise.resolve({ success: true })
      })
    })

    afterEach(() => unspyify(Email, 'sendSimpleEmail'))

    const posts = () => ({ discussions: [{ id: 1, title: 'Hello', user: { id: 0, name: 'Someone' } }] })

    it("a group's digest names the group", async () => {
      const user = await member()
      await sendToUser(user, 'daily', { group_id: group.id, group_name: 'Orchard', ...posts() })
      expect(calls[0].extraOptions.unsubscribe).to.deep.equal({ groupId: group.id })
    })

    it('the unified digest names its frequency', async () => {
      const user = await member()
      await sendToUser(user, 'daily', { unified: true, group_id: null, group_name: 'Hylo', ...posts() })
      expect(calls[0].extraOptions.unsubscribe).to.deep.equal({ frequency: 'daily' })
    })

    it('a saved search links to the settings page', async () => {
      const user = await member()
      await sendToUser(user, 'daily', { search: { get: () => 'Seeds' }, context: 'groups', group_name: 'Orchard', ...posts() })
      expect(calls[0].extraOptions.unsubscribe).to.deep.equal({ descriptor: 'settings_page' })
    })

    it('a weekly unified digest that carries a daily group slowed for being away covers it too (D9)', async () => {
      const author = await factories.user().save()
      const reader = await factories.user({ settings: { unified_email_digest: true }, last_active_at: daysAgo(45) }).save()
      const weeklyGroup = await factories.group().save()
      await group.addMembers([author.id])
      await group.addMembers([reader.id], { settings: { sendEmail: true, digestFrequency: 'daily' } })
      await weeklyGroup.addMembers([reader.id], { settings: { sendEmail: true, digestFrequency: 'weekly' } })
      for (const target of [group, weeklyGroup]) {
        const post = await factories.post({ user_id: author.id, type: 'discussion', created_at: daysAgo(2) }).save()
        await target.posts().attach(post)
      }

      await sendAllDigests('weekly', { groupIds: [group.id, weeklyGroup.id] })

      const toReader = calls.filter(call => call.address === reader.get('email'))
      expect(toReader).to.have.length(1)
      expect(toReader[0].data.unified).to.equal(true)
      expect(toReader[0].data.slowed_notice).to.match(/weekly digest/)
      expect(toReader[0].extraOptions.unsubscribe).to.deep.equal({ frequency: 'weekly', slowedDaily: true })
    })
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
