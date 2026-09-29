/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, spyify, unspyify } from '../../setup/helpers'
import {
  digestGroupIds,
  hasNews,
  promptQuietGroups,
  quietGroups,
  recipients,
  runDaily,
  sectionsFor,
  sendWeeklyEmails
} from '../../../lib/group/stewardDigest'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = days => new Date(Date.now() - days * DAY)

async function assignSystemRole (user, group, name) {
  const role = await GroupRole.findSystemRole(group.id, name)
  return MemberGroupRole.forge({ user_id: user.id, group_id: group.id, group_role_id: role.id, active: true }).save()
}

async function postIn (group, user, { at = new Date(), type = 'discussion' } = {}) {
  const post = await factories.post({ user_id: user.id, type, created_at: at }).save()
  await bookshelf.knex('groups_posts').insert({ post_id: post.id, group_id: group.id })
  return post
}

async function setMembershipCreatedAt (user, group, at) {
  await bookshelf.knex('group_memberships').where({ user_id: user.id, group_id: group.id }).update({ created_at: at })
}

async function quietNotices (readerId, groupId) {
  const activities = await Activity.query(q => {
    q.where({ reader_id: readerId, group_id: groupId })
    q.whereRaw("meta->'reasons' \\? 'groupQuiet'")
  }).fetchAll({ withRelated: 'notifications' })
  return activities.models.map(activity => activity.related('notifications').map(n => n.get('medium')))
}

describe('lib/group/stewardDigest', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  describe('the weekly steward email', () => {
    let group, administrator, moderator, host, adder, member, newcomer, now

    before(async () => {
      now = new Date()
      group = await factories.group({ name: 'Seed Library' }).save()
      administrator = await factories.user({ first_name: 'Ada' }).save()
      moderator = await factories.user().save()
      host = await factories.user().save()
      adder = await factories.user().save()
      member = await factories.user().save()
      newcomer = await factories.user({ name: 'Nia Newcomer' }).save()

      await administrator.joinGroup(group, { assignAdministrator: true })
      for (const person of [moderator, host, adder, member]) {
        await person.joinGroup(group)
        await setMembershipCreatedAt(person, group, daysAgo(90))
      }
      await setMembershipCreatedAt(administrator, group, daysAgo(90))
      await assignSystemRole(moderator, group, 'Moderator')
      await assignSystemRole(host, group, 'Host')
      const greeter = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '🙂', type: GroupRole.TYPE_CUSTOM, active: true }).save()
      const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
      await GroupRoleResponsibility.forge({ group_role_id: greeter.id, responsibility_id: addMembersId }).save()
      await MemberGroupRole.forge({ user_id: adder.id, group_id: group.id, group_role_id: greeter.id, active: true }).save()

      // The Moderator turned the email off
      await bookshelf.knex('group_memberships').where({ user_id: moderator.id, group_id: group.id })
        .update({ settings: bookshelf.knex.raw("settings || '{\"stewardDigest\": false}'::jsonb") })

      // New this week
      await newcomer.joinGroup(group)
      await setMembershipCreatedAt(newcomer, group, daysAgo(2))

      // Join requests: one waiting 5 days, one from yesterday
      const waiting = await factories.user({ name: 'Wes Waiting' }).save()
      const recent = await factories.user().save()
      await bookshelf.knex('join_requests').insert([
        { user_id: waiting.id, group_id: group.id, status: JoinRequest.STATUS.Pending, created_at: daysAgo(5) },
        { user_id: recent.id, group_id: group.id, status: JoinRequest.STATUS.Pending, created_at: daysAgo(1) }
      ])

      // Activity: two posts and a comment this week, one post the week before
      const post = await postIn(group, member, { at: daysAgo(1) })
      await postIn(group, member, { at: daysAgo(3) })
      await postIn(group, member, { at: daysAgo(10) })
      await postIn(group, member, { at: daysAgo(1), type: 'chat' })
      await factories.comment({ post_id: post.id, user_id: host.id, created_at: daysAgo(1) }).save()

      // An open report about that post
      await bookshelf.knex('moderation_actions').insert({
        reporter_id: host.id, post_id: post.id, group_id: group.id, text: 'Off topic', status: 'active', queue: 'group', created_at: daysAgo(1)
      })

      // A newcomer's first post that was nudged and still has no response
      const firstPost = await postIn(group, newcomer, { at: daysAgo(1) })
      await bookshelf.knex('first_post_nudges').insert({
        post_id: firstPost.id, group_id: group.id, user_id: newcomer.id, variant: 'nudge', nudged_at: daysAgo(0.5)
      })
    })

    afterEach(() => unspyify(Email, 'sendStewardWeekly'))

    it('goes to Administrators, Moderators and Hosts by role, leaving out whoever turned it off', async () => {
      expect(await recipients(group.id)).to.have.members([administrator.id, host.id].map(String))
    })

    it('fills each section', async () => {
      const sections = await sectionsFor(group, { now })
      expect(sections.newMemberCount).to.equal(1)
      expect(sections.newMembers[0].name).to.equal('Nia Newcomer')
      expect(sections.waitingRequestCount).to.equal(1)
      expect(sections.waitingRequests[0].name).to.equal('Wes Waiting')
      expect(sections.openReports).to.equal(1)
      expect(sections.newReports).to.equal(1)
      // The newcomer's first post counts too; chats don't
      expect(sections.postsThisWeek).to.equal(3)
      expect(sections.postsLastWeek).to.equal(1)
      expect(sections.commentsThisWeek).to.equal(1)
      expect(sections.firstPosts).to.have.length(1)
      expect(sections.quiet).to.be.false
    })

    it('emails each steward once a week with the sections and their own links', async () => {
      mockify(Email, 'sendStewardWeekly', () => Promise.resolve(true))
      const result = await sendWeeklyEmails({ now })
      expect(result).to.deep.equal({ groups: 1, emails: 2 })

      const calls = Email.sendStewardWeekly.__spy.calls.map(call => call[0])
      expect(calls.map(c => c.email)).to.have.members([administrator.get('email'), host.get('email')])
      const toAdministrator = calls.find(c => c.email === administrator.get('email'))
      expect(toAdministrator.unsubscribe).to.deep.equal({ userId: administrator.id, groupId: group.id })
      expect(toAdministrator.data).to.include({
        subject: 'This week in Seed Library, for stewards',
        first_name: 'Ada',
        group_name: 'Seed Library',
        new_member_count: 1,
        waiting_request_count: 1,
        open_report_count: 1,
        posts_this_week: 3,
        posts_last_week: 1,
        group_quiet: false
      })
      expect(toAdministrator.data.waiting_requests[0].days_waiting).to.equal(5)
      expect(toAdministrator.data.unanswered_first_posts[0].author_name).to.equal('Nia Newcomer')
      expect(toAdministrator.data.members_url).to.match(/\/members\?s=join/)
      expect(toAdministrator.data.steward_settings_url).to.match(new RegExp(`/my/notifications\\?group=${group.id}`))

      // Not again the same week
      expect(await sendWeeklyEmails({ now })).to.deep.equal({ groups: 0, emails: 0 })
      expect(await digestGroupIds({ now })).to.not.include(String(group.id))
    })

    it('skips groups with nothing to report', async () => {
      const idle = await factories.group().save()
      const steward = await factories.user().save()
      await steward.joinGroup(idle, { assignAdministrator: true })
      await setMembershipCreatedAt(steward, idle, daysAgo(90))
      expect(await digestGroupIds({ now })).to.not.include(String(idle.id))
    })

    it('leaves out requests and reports older than the look-back, so a long-dormant group gets no email', async () => {
      const dormant = await factories.group().save()
      const steward = await factories.user().save()
      const author = await factories.user().save()
      const requester = await factories.user().save()
      for (const person of [steward, author]) {
        await person.joinGroup(dormant, { assignAdministrator: person === steward })
        await setMembershipCreatedAt(person, dormant, daysAgo(900))
      }
      const oldPost = await postIn(dormant, author, { at: daysAgo(800) })
      await bookshelf.knex('join_requests').insert({
        user_id: requester.id, group_id: dormant.id, status: JoinRequest.STATUS.Pending, created_at: daysAgo(800)
      })
      await bookshelf.knex('moderation_actions').insert({
        reporter_id: steward.id, post_id: oldPost.id, group_id: dormant.id, text: 'Off topic', status: 'active', queue: 'group', created_at: daysAgo(700)
      })

      expect(await digestGroupIds({ now })).to.not.include(String(dormant.id))
      const sections = await sectionsFor(dormant, { now })
      expect(sections.waitingRequestCount).to.equal(0)
      expect(sections.openReports).to.equal(0)
      expect(hasNews(sections)).to.be.false
    })

    it('does not count the creator of a group made this week as a new member', async () => {
      const fresh = await factories.group().save()
      const founder = await factories.user().save()
      await founder.joinGroup(fresh, { assignAdministrator: true, joinSource: GroupMembership.JoinSource.CREATOR })
      expect(await digestGroupIds({ now })).to.not.include(String(fresh.id))
      expect((await sectionsFor(fresh, { now })).newMemberCount).to.equal(0)
    })

    it('runs the 14-day check every day and the email only on the digest weekday', async () => {
      mockify(Email, 'sendStewardWeekly', () => Promise.resolve(true))
      spyify(JoinRequest, 'notifyUnanswered')
      try {
        const tuesday = await runDaily({ now: new Date(now.getTime() + 7 * DAY), weekday: 2 })
        expect(tuesday.weekly).to.deep.equal({ groups: 0, emails: 0 })
        expect(JoinRequest.notifyUnanswered).to.have.been.called.once

        const monday = await runDaily({ now: new Date(now.getTime() + 7 * DAY), weekday: 1 })
        expect(JoinRequest.notifyUnanswered).to.have.been.called.twice
        expect(monday.weekly.groups).to.equal(1)
      } finally {
        unspyify(JoinRequest, 'notifyUnanswered')
      }
    })
  })

  describe('the cap on groups per run', () => {
    let now, groups, members

    before(async () => {
      await setup.clearDb()
      now = new Date()
      groups = []
      members = []
      for (let i = 0; i < 3; i++) {
        const g = await factories.group({ name: `Garden ${i + 1}` }).save()
        const steward = await factories.user().save()
        const member = await factories.user().save()
        await steward.joinGroup(g, { assignAdministrator: true })
        await member.joinGroup(g)
        for (const person of [steward, member]) await setMembershipCreatedAt(person, g, daysAgo(90))
        await postIn(g, member, { at: daysAgo(1) })
        groups.push(g)
        members.push(member)
      }
    })

    afterEach(() => {
      unspyify(Email, 'sendStewardWeekly')
      unspyify(Group, 'find')
    })

    it('serves the groups that went longest without being handled first, so a group the cap left out comes first the next week', async () => {
      mockify(Email, 'sendStewardWeekly', () => Promise.resolve(true))
      const [first, second, third] = groups
      expect(await sendWeeklyEmails({ now, limit: 2 })).to.deep.equal({ groups: 2, emails: 2 })
      const emailed = Email.sendStewardWeekly.__spy.calls.map(call => call[0].data.group_name)
      expect(emailed).to.have.members([first.get('name'), second.get('name')])

      const nextWeek = new Date(now.getTime() + 7 * DAY)
      expect((await digestGroupIds({ now: nextWeek }))[0]).to.equal(String(third.id))
      expect(await sendWeeklyEmails({ now: nextWeek, limit: 1 })).to.deep.equal({ groups: 1, emails: 1 })
      expect(Email.sendStewardWeekly.__spy.calls[2][0].data.group_name).to.equal(third.get('name'))
    })

    it('counts only emails that were sent, and keeps going when one group fails', async () => {
      const [first, second, third] = groups
      const when = new Date(now.getTime() + 21 * DAY)
      for (let i = 0; i < groups.length; i++) {
        await postIn(groups[i], members[i], { at: new Date(when.getTime() - DAY) })
      }
      mockify(Group, 'find', (id, ...rest) => String(id) === String(first.id)
        ? Promise.reject(new Error('Unavailable'))
        : Group._originalfind(id, ...rest))
      mockify(Email, 'sendStewardWeekly', ({ data }) =>
        Promise.resolve(data.group_name === second.get('name') ? null : true))

      expect(await sendWeeklyEmails({ now: when })).to.deep.equal({ groups: 1, emails: 1 })
      expect(Email.sendStewardWeekly.__spy.calls.map(call => call[0].data.group_name))
        .to.have.members([second.get('name'), third.get('name')])
    })
  })

  describe('the prompt when a group goes quiet', () => {
    let quiet, steward, member, now

    before(async () => {
      now = new Date()
      quiet = await factories.group({ name: 'Quiet Garden' }).save()
      await bookshelf.knex('groups').where('id', quiet.id).update({ created_at: daysAgo(100) })
      steward = await factories.user().save()
      member = await factories.user().save()
      await steward.joinGroup(quiet, { assignAdministrator: true })
      await member.joinGroup(quiet)
      await postIn(quiet, member, { at: daysAgo(35) })
    })

    it('finds groups with members whose posts stopped 30 days ago, not long-dormant, busy or one-person groups', async () => {
      const dormant = await factories.group().save()
      await bookshelf.knex('groups').where('id', dormant.id).update({ created_at: daysAgo(300) })
      const busy = await factories.group().save()
      const alone = await factories.group().save()
      for (const g of [dormant, busy]) {
        await steward.joinGroup(g, { assignAdministrator: true })
        await member.joinGroup(g)
      }
      await steward.joinGroup(alone, { assignAdministrator: true })
      await postIn(dormant, member, { at: daysAgo(100) })
      await postIn(busy, member, { at: daysAgo(35) })
      await postIn(busy, member, { at: daysAgo(2), type: 'chat' })
      await postIn(alone, steward, { at: daysAgo(40) })

      const ids = (await quietGroups({ now })).map(row => row.groupId)
      expect(ids).to.include(String(quiet.id))
      for (const g of [dormant, busy, alone]) expect(ids).to.not.include(String(g.id))
    })

    it('prompts its stewards in-app once per quiet spell, and puts a line in that week\'s email', async () => {
      await promptQuietGroups({ now })
      expect(await quietNotices(steward.id, quiet.id)).to.deep.equal([[Notification.MEDIUM.InApp]])
      expect(await quietNotices(member.id, quiet.id)).to.be.empty
      expect((await sectionsFor(quiet, { now })).quiet).to.be.true

      await promptQuietGroups({ now: new Date(now.getTime() + 5 * DAY) })
      expect(await quietNotices(steward.id, quiet.id)).to.have.length(1)

      // Someone posts, then it goes quiet again: a new spell, a new prompt
      await postIn(quiet, member, { at: new Date(now.getTime() + 10 * DAY) })
      await promptQuietGroups({ now: new Date(now.getTime() + 45 * DAY) })
      expect(await quietNotices(steward.id, quiet.id)).to.have.length(2)
    })
  })
})
