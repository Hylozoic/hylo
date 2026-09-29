// One win-back email per absence for members who pass 180 days away (D9)
import { resetReturnedMembers, sendWinbackEmails, winbackCandidateIds, winbackData } from '../../../../api/models/user/winback'
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { mockify, unspyify } from '../../../setup/helpers'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY)

describe('win-back email', () => {
  let group, sends

  const member = async (attrs = {}) => {
    const user = await factories.user({ settings: {}, ...attrs }).save()
    await group.addMembers([user.id])
    return user
  }

  const settingsOf = async user => (await User.where({ id: user.id }).fetch()).get('settings') || {}

  beforeEach(async () => {
    await setup.clearDb()
    group = await factories.group({ name: 'Orchard' }).save()
    sends = []
    mockify(Email, 'winbackTemplateReady', () => true)
    mockify(Email, 'sendWinbackEmail', opts => { sends.push(opts); return Promise.resolve({ success: true }) })
  })

  afterEach(() => {
    unspyify(Email, 'winbackTemplateReady')
    unspyify(Email, 'sendWinbackEmail')
  })

  it('goes once to a member who just passed 180 days away', async () => {
    const lapsed = await member({ last_active_at: daysAgo(182) })
    await member({ last_active_at: daysAgo(100) })

    expect(await sendWinbackEmails()).to.equal(1)
    expect(sends.map(s => s.email)).to.deep.equal([lapsed.get('email')])
    expect((await settingsOf(lapsed)).winback_sent_at).to.be.a('string')

    expect(await sendWinbackEmails()).to.equal(0)
    expect(sends).to.have.length(1)
  })

  it('leaves out absences that began long before', async () => {
    await member({ last_active_at: daysAgo(400) })

    expect(await sendWinbackEmails()).to.equal(0)
  })

  it('uses the signup date for someone who was never active', async () => {
    const neverActive = await member({ last_active_at: null, created_at: daysAgo(185) })

    expect((await winbackCandidateIds()).map(String)).to.deep.equal([String(neverActive.id)])
  })

  it('resets when they come back, so a later absence gets its own', async () => {
    const lapsed = await member({ last_active_at: daysAgo(182) })
    await sendWinbackEmails()
    expect(sends).to.have.length(1)

    await lapsed.save({ last_active_at: new Date() }, { patch: true })
    await resetReturnedMembers()
    expect(await settingsOf(lapsed)).not.to.have.property('winback_sent_at')

    // Away again for more than 180 days
    await lapsed.save({ last_active_at: daysAgo(181) }, { patch: true })
    expect(await sendWinbackEmails()).to.equal(1)
    expect(sends).to.have.length(2)
  })

  it("skips people who chose 'everything except direct' or 'everything', undeliverable addresses and people in no group", async () => {
    await member({ last_active_at: daysAgo(182), settings: { email_unsubscribe_scope: 'all_but_direct' } })
    await member({ last_active_at: daysAgo(182), settings: { email_unsubscribe_scope: 'everything' } })
    await member({ last_active_at: daysAgo(182), email_undeliverable_at: new Date() })
    await factories.user({ last_active_at: daysAgo(182) }).save()

    expect(await sendWinbackEmails()).to.equal(0)
  })

  it('sends nothing, and marks nobody, until the template exists', async () => {
    mockify(Email, 'winbackTemplateReady', () => false)
    const lapsed = await member({ last_active_at: daysAgo(182) })

    expect(await sendWinbackEmails()).to.equal(0)
    expect(sends).to.have.length(0)
    expect(await settingsOf(lapsed)).not.to.have.property('winback_sent_at')
  })

  it('names their groups with the posts they missed', async () => {
    const lapsed = await member({ last_active_at: daysAgo(182), first_name: 'Alex' })
    const post = await factories.post({ type: 'discussion', created_at: daysAgo(10) }).save()
    await group.posts().attach(post)

    const data = await winbackData(lapsed)
    expect(data.first_name).to.equal('Alex')
    expect(data.home_url).to.match(/ctt=winback_email/)
    expect(data.email_settings_url).to.match(/token=/)
    expect(data.groups).to.deep.equal([{ name: 'Orchard', url: data.groups[0].url, new_post_count: 1 }])
    expect(data.groups[0].url).to.match(new RegExp(`/groups/${group.get('slug')}$`))
  })
})
