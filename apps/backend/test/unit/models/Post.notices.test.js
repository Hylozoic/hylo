/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { REACTION_NOTICES, TABLE as ASSIGNMENTS } from '../../../lib/experiments'
import { notifyProposalsClosed, sendClosingSoonNotices, sendProposalNotices, votingResult } from '../../../api/models/post/proposalNotices'
import { noticesSettled } from '../../../api/models/notification/socialNotices'

const activitiesWithReason = async (reason, where = {}) => (await Activity.query(q => {
  q.where(where)
  q.whereRaw("meta->'reasons' \\? ?", [reason])
  q.orderBy('id')
}).fetchAll()).models

const mediaFor = async activity =>
  (await Notification.where({ activity_id: activity.id }).fetchAll()).pluck('medium').sort()

const { InApp, Push } = { InApp: 0, Push: 1 }

describe('Post notices', () => {
  let group, author, fans

  before(async () => {
    await setup.clearDb()
    author = await factories.user({ name: 'Ada Author' }).save()
    fans = await Promise.all(['Sam', 'Kim', 'Lee'].map(name => factories.user({ name }).save()))
    group = await factories.group({ name: 'Garden Group' }).save()
    await group.addMembers([author, ...fans])
  })

  beforeEach(async () => {
    mockify(Queue, 'classMethod', () => Promise.resolve())
    mockify(OneSignal, 'notify', () => Promise.resolve(true))
    await bookshelf.knex('notifications').del()
    await bookshelf.knex('push_notifications').del()
    await bookshelf.knex('activities').del()
    await bookshelf.knex(ASSIGNMENTS).del()
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
    unspyify(OneSignal, 'notify')
  })

  const postBy = async (user, attrs = {}) => {
    const post = await factories.post({ user_id: user.id, type: 'discussion', name: 'Seed swap on Saturday', ...attrs }).save()
    await group.posts().attach(post)
    return post
  }

  describe('reactions (D15)', () => {
    const assignVariant = (userId, variant) => bookshelf.knex(ASSIGNMENTS).insert({
      experiment: REACTION_NOTICES.name,
      subject_type: REACTION_NOTICES.subjectType,
      subject_id: userId,
      variant,
      assigned_at: new Date()
    })

    it('gives an author in the notices arm one grouped notice, in-app and push', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await noticesSettled()
      await post.addReaction(fans[1].id, '🎉')
      await noticesSettled()
      await post.addReaction(fans[1].id, '👍')
      await noticesSettled()

      const activities = await activitiesWithReason('reaction', { reader_id: author.id })
      expect(activities.length).to.equal(1)
      expect(activities[0].get('group_key')).to.equal(`reaction:post:${post.id}`)
      expect(activities[0].get('meta').actorCount).to.equal(2)
      expect(await mediaFor(activities[0])).to.deep.equal([InApp, Push])
    })

    it('pushes the grouped text and collapses later pushes for the same post', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await noticesSettled()
      await post.addReaction(fans[1].id, '👍')
      await noticesSettled()

      const [activity] = await activitiesWithReason('reaction', { reader_id: author.id })
      const push = await Notification.where({ activity_id: activity.id, medium: Push }).fetch({
        withRelated: ['activity', 'activity.post', 'activity.post.groups', 'activity.post.user', 'activity.reader', 'activity.actor', 'activity.comment']
      })
      await push.send()
      const opts = OneSignal.notify.__spy.calls[0][0]
      expect(opts.alert).to.equal('Kim and 1 other reacted to your post "Seed swap on Saturday"')
      expect(opts.collapseKey).to.equal(`reaction:post:${post.id}`)
      expect(opts.heading).to.equal('Garden Group')
    })

    it('does not notify an author in the control arm', async () => {
      await assignVariant(author.id, 'control')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await noticesSettled()
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })

    it('does nothing for a self-reaction, and does not assign the author', async () => {
      const post = await postBy(author)
      await post.addReaction(author.id, '👍')
      await noticesSettled()
      expect(await activitiesWithReason('reaction')).to.have.length(0)
      expect(await bookshelf.knex(ASSIGNMENTS).where({ subject_id: author.id }).first()).to.not.exist
    })

    it('does nothing for reactions to chat messages', async () => {
      await assignVariant(author.id, 'notices')
      const chat = await postBy(author, { type: 'chat' })
      await chat.addReaction(fans[0].id, '👍')
      await noticesSettled()
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })

    it('does nothing between people who have blocked each other', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await BlockedUser.create(author.id, fans[2].id)
      try {
        await post.addReaction(fans[2].id, '👍')
        await noticesSettled()
        expect(await activitiesWithReason('reaction')).to.have.length(0)
      } finally {
        await bookshelf.knex('blocked_users').del()
      }
    })

    it('does not notify when a reaction is removed', async () => {
      await assignVariant(author.id, 'notices')
      const post = await postBy(author)
      await post.addReaction(fans[0].id, '👍')
      await noticesSettled()
      await bookshelf.knex('notifications').del()
      await bookshelf.knex('activities').del()
      await post.deleteReaction(fans[0].id, '👍')
      expect(await activitiesWithReason('reaction')).to.have.length(0)
    })
  })
  describe('proposals (D46)', () => {
    const HOUR = 60 * 60 * 1000

    // Each test looks at its own proposals only
    beforeEach(() => bookshelf.knex('posts').where({ type: 'proposal' }).update({ active: false }))

    const proposalBy = async (user, attrs = {}) => {
      const post = await postBy(user, {
        type: 'proposal',
        name: 'Paint the shed',
        proposal_status: Post.Proposal_Status.VOTING,
        start_time: new Date(Date.now() - 3 * 24 * HOUR),
        end_time: new Date(Date.now() + 10 * HOUR),
        ...attrs
      })
      const [yes, no] = await bookshelf.knex('proposal_options')
        .insert([{ post_id: post.id, text: 'Yes', emoji: '👍' }, { post_id: post.id, text: 'No', emoji: '👎' }])
        .returning('id')
      return { post, yes: yes.id || yes, no: no.id || no }
    }

    // The author's notice is sent after the vote responds
    const vote = async (post, user, optionId) => {
      await post.addProposalVote({ userId: user.id, optionId })
      await noticesSettled()
    }

    describe('votes', () => {
      it('tell the author in-app only, grouped per proposal', async () => {
        const { post, yes, no } = await proposalBy(author)
        await vote(post, fans[0], yes)
        await vote(post, fans[1], no)
        await vote(post, fans[1], yes)

        const activities = await activitiesWithReason('proposalVote', { reader_id: author.id })
        expect(activities.length).to.equal(1)
        expect(activities[0].get('meta').actorCount).to.equal(2)
        expect(await mediaFor(activities[0])).to.deep.equal([InApp])
      })

      it("don't name voters on an anonymous proposal, or notify for the author's own vote", async () => {
        const { post: anonymous, yes } = await proposalBy(author, { anonymous_voting: 'true' })
        await vote(anonymous, fans[0], yes)
        const { post, yes: ownYes } = await proposalBy(author)
        await vote(post, author, ownYes)
        expect(await activitiesWithReason('proposalVote')).to.have.length(0)
      })
    })

    describe('closing soon', () => {
      it('goes once, in-app and push, to members who have not voted', async () => {
        const { post, yes } = await proposalBy(author)
        await vote(post, fans[0], yes)
        await bookshelf.knex('notifications').del()
        await bookshelf.knex('activities').del()

        expect(await sendClosingSoonNotices()).to.equal(2)
        const activities = await activitiesWithReason('proposalClosingSoon')
        expect(activities.map(a => String(a.get('reader_id'))).sort()).to.deep.equal([fans[1].id, fans[2].id].map(String).sort())
        expect(activities[0].get('group_key')).to.equal(`proposalClosingSoon:post:${post.id}`)
        expect(await mediaFor(activities[0])).to.deep.equal([InApp, Push])

        expect(await sendClosingSoonNotices()).to.equal(0)
        expect(await activitiesWithReason('proposalClosingSoon')).to.have.length(2)
      })

      it('waits for the last day of voting and at least half of the voting time', async () => {
        await proposalBy(author, { end_time: new Date(Date.now() + 30 * HOUR) })
        await proposalBy(author, { start_time: new Date(Date.now() - HOUR), end_time: new Date(Date.now() + 5 * HOUR) })
        await proposalBy(author, { proposal_status: Post.Proposal_Status.DISCUSSION })
        expect(await sendClosingSoonNotices()).to.equal(0)
      })

      it('pushes that voting closes soon', async () => {
        const { post } = await proposalBy(author)
        await sendClosingSoonNotices()
        const [activity] = await activitiesWithReason('proposalClosingSoon', { reader_id: fans[0].id })
        const push = await Notification.where({ activity_id: activity.id, medium: Push }).fetch({
          withRelated: ['activity', 'activity.post', 'activity.post.groups', 'activity.post.user', 'activity.reader', 'activity.actor']
        })
        await push.send()
        expect(OneSignal.notify.__spy.calls[0][0].alert).to.equal(`Voting closes soon on "${post.get('name')}". You haven't voted yet`)
      })
    })

    describe('voting closed', () => {
      it('updateProposalStatuses returns the proposals it completes', async () => {
        const { post: ended } = await proposalBy(author, { end_time: new Date(Date.now() - HOUR) })
        const { post: open } = await proposalBy(author)
        const completed = await Post.updateProposalStatuses()
        expect(completed).to.include(String(ended.id))
        expect(completed).to.not.include(String(open.id))
        expect(await Post.updateProposalStatuses()).to.not.include(String(ended.id))
      })

      it('tells voters the winning option and asks the author to record the outcome, once', async () => {
        const { post, yes, no } = await proposalBy(author)
        await vote(post, fans[0], yes)
        await vote(post, fans[1], yes)
        await vote(post, fans[2], no)
        await post.save({ end_time: new Date(Date.now() - HOUR) }, { patch: true })
        await bookshelf.knex('notifications').del()
        await bookshelf.knex('activities').del()

        const completed = await Post.updateProposalStatuses()
        expect(await notifyProposalsClosed(completed)).to.equal(4)

        const voters = await activitiesWithReason('proposalClosed')
        const forAuthor = voters.filter(a => a.get('meta').forAuthor)
        expect(forAuthor.map(a => String(a.get('reader_id')))).to.deep.equal([String(author.id)])
        expect(voters.filter(a => !a.get('meta').forAuthor).map(a => String(a.get('reader_id'))).sort())
          .to.deep.equal(fans.map(f => String(f.id)).sort())
        expect(voters[0].get('meta').winningOption).to.equal('👍 Yes')
        expect(await mediaFor(voters[0])).to.deep.equal([InApp, Push])

        expect(await notifyProposalsClosed(completed)).to.equal(0)
      })

      it('also picks up a proposal completed by editing its end time into the past', async () => {
        const { post, yes } = await proposalBy(author, { proposal_status: Post.Proposal_Status.COMPLETED, end_time: new Date(Date.now() - HOUR) })
        await vote(post, fans[0], yes)
        await bookshelf.knex('posts').where({ id: post.id }).update({ created_at: new Date(Date.now() - 4 * 24 * HOUR) })
        // Recorded after the fact: created with its end time already past
        await proposalBy(author, { proposal_status: Post.Proposal_Status.COMPLETED, end_time: new Date(Date.now() - HOUR) })
        await bookshelf.knex('notifications').del()
        await bookshelf.knex('activities').del()

        expect(await sendProposalNotices({ completedIds: [] })).to.deep.equal({ closed: 2, closingSoon: 0 })
        const closed = await activitiesWithReason('proposalClosed')
        expect(closed.map(a => String(a.get('post_id')))).to.deep.equal([String(post.id), String(post.id)])
        expect((await sendProposalNotices({ completedIds: [String(post.id)] })).closed).to.equal(0)
      })

      it('reports a tie, or that no one voted', async () => {
        const { post, yes, no } = await proposalBy(author)
        expect(await votingResult(post.id)).to.deep.equal({ winningOption: null, tie: false })
        await vote(post, fans[0], yes)
        await vote(post, fans[1], no)
        expect(await votingResult(post.id)).to.deep.equal({ winningOption: null, tie: true })
      })
    })

    describe('vote reset', () => {
      it('changing the options of a voted proposal notifies voters, in-app and push', async () => {
        const { post, yes } = await proposalBy(author, { proposal_status: Post.Proposal_Status.DISCUSSION })
        await vote(post, fans[0], yes)
        await vote(post, author, yes)
        await bookshelf.knex('notifications').del()
        await bookshelf.knex('activities').del()

        await post.updateProposalOptions({ options: [{ text: 'Blue' }, { text: 'Green' }], userId: author.id })

        const activities = await activitiesWithReason('voteReset')
        expect(activities.map(a => String(a.get('reader_id')))).to.deep.equal([String(fans[0].id)])
        expect(await mediaFor(activities[0])).to.deep.equal([InApp, Push])
      })

      it('comes from whoever changed the options, and not to them', async () => {
        const { post, yes } = await proposalBy(author, { proposal_status: Post.Proposal_Status.DISCUSSION })
        await vote(post, fans[0], yes)
        await vote(post, fans[1], yes)
        await vote(post, author, yes)
        await bookshelf.knex('notifications').del()
        await bookshelf.knex('activities').del()

        await post.updateProposalOptions({ options: [{ text: 'Blue' }, { text: 'Green' }], userId: fans[1].id })

        const activities = await activitiesWithReason('voteReset')
        expect(activities.map(a => String(a.get('reader_id'))).sort()).to.deep.equal([author.id, fans[0].id].map(String).sort())
        expect(activities.map(a => String(a.get('actor_id')))).to.deep.equal([String(fans[1].id), String(fans[1].id)])
      })
    })
  })
})
