/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { LIFECYCLE_EMAILS_HOLDOUT, TABLE as EXPERIMENT_TABLE } from '../../../lib/experiments'
import { LIFECYCLE_EMAILS, SIGNUP_COMPLETED_SETTING, sendLifecycleEmails } from '../../../api/models/user/lifecycleEmails'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY).toISOString()

describe('User lifecycle email', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  describe('the welcome email', () => {
    let sent

    beforeEach(() => {
      sent = []
      mockify(Email, 'sendWelcomeEmail', opts => { sent.push(opts); return Promise.resolve(true) })
    })

    afterEach(() => unspyify(Email, 'sendWelcomeEmail'))

    it("goes out in the recipient's language", async () => {
      const user = await factories.user({ settings: { locale: 'es' } }).save()
      await User.sendWelcomeEmail({ userId: user.id })
      expect(sent).to.have.length(1)
      expect(sent[0].locale).to.equal('es-ES')
      expect(sent[0].email).to.equal(user.get('email'))
    })

    it('falls back to English', async () => {
      const user = await factories.user({ settings: {} }).save()
      await User.sendWelcomeEmail({ userId: user.id })
      expect(sent[0].locale).to.equal('en-US')
    })
  })

  describe('finishing signup', () => {
    it('records when signup was finished, once', async () => {
      const user = await factories.user({ settings: { signup_in_progress: true } }).save()
      await user.validateAndSave(null, { settings: { signup_in_progress: false } })
      await user.refresh()
      const finishedAt = user.getSetting(SIGNUP_COMPLETED_SETTING)
      expect(new Date(finishedAt).getTime()).to.be.closeTo(Date.now(), 60 * 1000)

      await user.validateAndSave(null, { settings: { signup_in_progress: false, locale: 'de' } })
      await user.refresh()
      expect(user.getSetting(SIGNUP_COMPLETED_SETTING)).to.equal(finishedAt)
    })

    it('does not record it for an account that had already finished signing up', async () => {
      // For example an older account going through the welcome steps again
      const user = await factories.user({ settings: { signup_in_progress: false } }).save()
      await user.validateAndSave(null, { settings: { signup_in_progress: false } })
      await user.refresh()
      expect(user.getSetting(SIGNUP_COMPLETED_SETTING)).to.be.undefined
    })
  })

  describe('day-2 and day-3 emails (D12)', () => {
    let findGroup, introduce, group

    // Someone who finished signing up `days` ago, in the emails arm unless told otherwise
    const newcomer = async (days, { variant = 'emails', settings = {}, ...attrs } = {}) => {
      const user = await factories.user({ settings: { locale: 'en-US', signup_in_progress: false, [SIGNUP_COMPLETED_SETTING]: daysAgo(days), ...settings }, ...attrs }).save()
      if (variant) {
        await bookshelf.knex(EXPERIMENT_TABLE).insert({
          experiment: LIFECYCLE_EMAILS_HOLDOUT.name, subject_type: 'user', subject_id: user.id, variant
        })
      }
      return user
    }
    const sentTo = (list, user) => list.filter(opts => opts.email === user.get('email'))
    const variantOf = async user => (await bookshelf.knex(EXPERIMENT_TABLE)
      .where({ experiment: LIFECYCLE_EMAILS_HOLDOUT.name, subject_id: user.id }).first('variant'))?.variant

    beforeEach(async () => {
      await setup.clearDb()
      findGroup = []
      introduce = []
      mockify(Email, 'lifecycleTemplatesReady', () => ({ findGroup: true, introduce: true }))
      mockify(Email, 'sendLifecycleFindGroupEmail', opts => { findGroup.push(opts); return Promise.resolve(true) })
      mockify(Email, 'sendLifecycleIntroduceEmail', opts => { introduce.push(opts); return Promise.resolve(true) })
      group = await factories.group({ name: 'Seed Library' }).save()
    })

    afterEach(() => {
      unspyify(Email, 'lifecycleTemplatesReady')
      unspyify(Email, 'sendLifecycleFindGroupEmail')
      unspyify(Email, 'sendLifecycleIntroduceEmail')
    })

    it('sends "find a group" on day 2 to someone in no group, once', async () => {
      const due = await newcomer(2.5)
      const tooSoon = await newcomer(1)
      const tooLate = await newcomer(2 + 3)
      const inAGroup = await newcomer(2.5)
      await group.addMembers([inAGroup.id])
      // Finished signing up before this shipped, so there is no finish time
      const olderAccount = await factories.user({ settings: { signup_in_progress: false }, created_at: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000) }).save()

      expect(await sendLifecycleEmails()).to.deep.equal({ findGroup: 1, introduce: 0 })
      expect(sentTo(findGroup, due)).to.have.length(1)
      expect(sentTo(findGroup, tooSoon)).to.have.length(0)
      expect(sentTo(findGroup, tooLate)).to.have.length(0)
      expect(sentTo(findGroup, inAGroup)).to.have.length(0)
      expect(sentTo(findGroup, olderAccount)).to.have.length(0)
      const { data } = sentTo(findGroup, due)[0]
      expect(data.subject).to.equal('Find a group to join on Hylo')
      expect(data.explore_url).to.match(/\/public\/groups\?ctt=lifecycle_find_group_email&cti=/)
      await due.refresh()
      expect(due.getSetting(LIFECYCLE_EMAILS.findGroup.setting)).to.be.a('string')

      await sendLifecycleEmails()
      expect(sentTo(findGroup, due)).to.have.length(1)
    })

    it('sends "introduce yourself" on day 3 to a member who has not posted, linking to the composer', async () => {
      const quiet = await newcomer(3.5)
      const poster = await newcomer(3.5)
      await group.addMembers([quiet.id, poster.id])
      const post = await factories.post({ user_id: poster.id, type: 'discussion' }).save()
      await group.posts().attach(post)

      await sendLifecycleEmails()
      expect(sentTo(introduce, poster)).to.have.length(0)
      expect(sentTo(introduce, quiet)).to.have.length(1)
      const { data } = sentTo(introduce, quiet)[0]
      expect(data.subject).to.equal('Introduce yourself in Seed Library')
      expect(data.group_name).to.equal('Seed Library')
      expect(data.introduce_url).to.contain('create=post')
      expect(data.introduce_url).to.contain('template=intro')
      expect(data.introduce_url).to.contain('ctt=lifecycle_introduce_email')

      await sendLifecycleEmails()
      expect(sentTo(introduce, quiet)).to.have.length(1)
    })

    it('buckets people the first time they are eligible, and sends the holdout neither email', async () => {
      const heldOut = await newcomer(2.5, { variant: 'holdout' })
      const heldOutMember = await newcomer(3.5, { variant: 'holdout' })
      await group.addMembers([heldOutMember.id])
      const unbucketed = await newcomer(2.5, { variant: null })
      const notYetEligible = await newcomer(0.5, { variant: null })

      await sendLifecycleEmails()
      expect(sentTo(findGroup, heldOut)).to.have.length(0)
      expect(sentTo(introduce, heldOutMember)).to.have.length(0)
      expect(await variantOf(unbucketed)).to.be.oneOf(['holdout', 'emails'])
      expect(sentTo(findGroup, unbucketed)).to.have.length(await variantOf(unbucketed) === 'emails' ? 1 : 0)
      expect(await variantOf(notYetEligible)).to.be.undefined
    })

    it("uses the recipient's language", async () => {
      const french = await newcomer(3.5, { settings: { locale: 'fr' } })
      await group.addMembers([french.id])
      await sendLifecycleEmails()
      const [sent] = sentTo(introduce, french)
      expect(sent.locale).to.equal('fr-FR')
      expect(sent.data.subject).to.equal('Présentez-vous dans Seed Library')
    })

    it("leaves out people who chose 'everything except direct' or 'everything', and undeliverable addresses", async () => {
      const allButDirect = await newcomer(2.5, { settings: { email_unsubscribe_scope: 'all_but_direct' } })
      const everything = await newcomer(2.5, { settings: { email_unsubscribe_scope: 'everything' } })
      const bounced = await newcomer(2.5, { email_undeliverable_at: new Date() })
      const digestOnly = await newcomer(2.5, { settings: { email_unsubscribe_scope: 'digest_only' } })

      await sendLifecycleEmails()
      expect(sentTo(findGroup, allButDirect)).to.have.length(0)
      expect(sentTo(findGroup, everything)).to.have.length(0)
      expect(sentTo(findGroup, bounced)).to.have.length(0)
      expect(sentTo(findGroup, digestOnly)).to.have.length(1)
    })

    it('does nothing for an email whose template is not uploaded', async () => {
      mockify(Email, 'lifecycleTemplatesReady', () => ({ findGroup: false, introduce: false }))
      const due = await newcomer(2.5, { variant: null })
      expect(await sendLifecycleEmails()).to.deep.equal({ findGroup: 0, introduce: 0 })
      expect(findGroup).to.have.length(0)
      expect(await variantOf(due)).to.be.undefined
    })
  })
})
