/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { PRIORITY_REASONS } from '../../../api/models/notification/priorityReasons'
import { EMAIL_REASONS } from '../../../api/models/notification/emailReasons'
import { locales } from '../../../lib/i18n/locales'

const relations = [
  'activity',
  'activity.post',
  'activity.post.groups',
  'activity.post.user',
  'activity.post.tags',
  'activity.reader',
  'activity.actor'
]

describe('vote reset notices', () => {
  let author, voter, group, post

  before(async () => {
    await setup.clearDb()
    author = await factories.user({ name: 'Ada' }).save()
    voter = await factories.user().save()
    group = await factories.group({ name: 'Garden Group' }).save()
    await group.addMembers([author, voter])
    post = await factories.post({ user_id: author.id, type: 'proposal', name: 'Paint the shed' }).save()
    await group.posts().attach(post)
  })

  beforeEach(() => mockify(OneSignal, 'notify', () => Promise.resolve(true)))
  afterEach(() => unspyify(OneSignal, 'notify'))

  it('is a priority reason, so the push and in-app title are reachable', () => {
    expect(PRIORITY_REASONS).to.include('voteReset')
    expect(Notification.priorityReason(['voteReset'])).to.equal('voteReset')
  })

  it('never emails', () => {
    expect(EMAIL_REASONS.has('voteReset')).to.be.false
  })

  it('creates in-app and push notifications for a voter', async () => {
    const activity = await Activity.createWithNotifications({
      reader_id: voter.id,
      actor_id: author.id,
      post_id: post.id,
      meta: { reasons: ['voteReset'] }
    })
    const media = (await Notification.where({ activity_id: activity.id }).fetchAll()).pluck('medium').sort()
    expect(media).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push])
  })

  it('pushes that the options changed and the vote was reset', async () => {
    const activity = await new Activity({ reader_id: voter.id, actor_id: author.id, post_id: post.id, meta: { reasons: ['voteReset'] } }).save()
    const push = await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.Push, user_id: voter.id }).save()
    await push.load(relations)
    await push.send()
    const opts = OneSignal.notify.__spy.calls[0][0]
    expect(opts.alert).to.equal('Ada changed the options for proposal: "Paint the shed" in Garden Group. This has reset the votes')
    expect(opts.heading).to.equal('Garden Group')
  })

  it('names whoever changed the options in the push', async () => {
    const changer = await factories.user({ name: 'Bo' }).save()
    const activity = await new Activity({ reader_id: voter.id, actor_id: changer.id, post_id: post.id, meta: { reasons: ['voteReset'] } }).save()
    const push = await new Notification({ activity_id: activity.id, medium: Notification.MEDIUM.Push, user_id: voter.id }).save()
    await push.load(relations)
    await push.send()
    expect(OneSignal.notify.__spy.calls[0][0].alert).to.equal('Bo changed the options for proposal: "Paint the shed" in Garden Group. This has reset the votes')
  })

  it('has push text for every new notice in all six languages', () => {
    const keys = [
      'textForReaction',
      'textForEventRsvp',
      'textForProposalClosingSoon',
      'textForProposalClosed',
      'textForProposalOutcome',
      'textForVoteReset'
    ]
    for (const [locale, strings] of Object.entries(locales)) {
      for (const key of keys) {
        expect(strings[key], `${locale}.${key}`).to.be.a('function')
      }
    }
  })
})
