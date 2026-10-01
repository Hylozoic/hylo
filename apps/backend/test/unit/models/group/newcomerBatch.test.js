/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { groupsWithNewMembers, runWeekly } from '../../../../api/models/group/newcomerBatch'

const DAY = 24 * 60 * 60 * 1000

async function join (user, group, { daysAgo, activeDaysAgo }) {
  await user.joinGroup(group)
  await bookshelf.knex('group_memberships')
    .where({ user_id: user.id, group_id: group.id })
    .update({ created_at: new Date(Date.now() - daysAgo * DAY) })
  await bookshelf.knex('users').where('id', user.id)
    .update({ last_active_at: activeDaysAgo == null ? null : new Date(Date.now() - activeDaysAgo * DAY) })
}

async function noticesFor (readerId) {
  const activities = await Activity.query(q => {
    q.where('reader_id', readerId)
    q.whereRaw("meta->'reasons' \\? 'newMembersJoined'")
  }).fetchAll({ withRelated: 'notifications' })
  return activities.models.map(activity => ({
    activity,
    media: activity.related('notifications').map(n => n.get('medium'))
  }))
}

describe('group/newcomerBatch (weekly "N people joined, say hi")', () => {
  let group, regular, dormant, newcomerA, newcomerB

  before(async () => {
    await setup.clearDb()
    group = await factories.group({ name: 'Seed Library' }).save()
    regular = await factories.user().save()
    dormant = await factories.user().save()
    newcomerA = await factories.user().save()
    newcomerB = await factories.user().save()
    await join(regular, group, { daysAgo: 60, activeDaysAgo: 2 })
    await join(dormant, group, { daysAgo: 60, activeDaysAgo: 90 })
    await join(newcomerA, group, { daysAgo: 3, activeDaysAgo: 1 })
    await join(newcomerB, group, { daysAgo: 1, activeDaysAgo: 0 })
  })

  after(() => setup.clearDb())

  it('gives recently active members one in-app notice with the count, and nothing else', async () => {
    const result = await runWeekly()
    expect(result).to.deep.equal({ groups: 1, notices: 1 })

    const notices = await noticesFor(regular.id)
    expect(notices).to.have.length(1)
    expect(notices[0].media).to.deep.equal([Notification.MEDIUM.InApp])
    const { activity } = notices[0]
    expect(activity.get('meta')).to.deep.equal({ reasons: ['newMembersJoined'], newMemberCount: 2 })
    expect(String(activity.get('group_id'))).to.equal(String(group.id))
    // The newest member is the actor, for the picture
    expect(String(activity.get('actor_id'))).to.equal(String(newcomerB.id))
  })

  it('leaves out the newcomers themselves and members who have not been around lately', async () => {
    for (const person of [dormant, newcomerA, newcomerB]) {
      expect(await noticesFor(person.id)).to.be.empty
    }
  })

  it('sends one notice per group per week', async () => {
    const later = await factories.user().save()
    await join(later, group, { daysAgo: 0, activeDaysAgo: 0 })
    expect(await runWeekly()).to.deep.equal({ groups: 0, notices: 0 })
    expect(await noticesFor(regular.id)).to.have.length(1)

    // A week later the group is due again, for that week's newcomers
    const nextWeek = new Date(Date.now() + 7 * DAY)
    await bookshelf.knex('group_memberships').where({ user_id: later.id, group_id: group.id })
      .update({ created_at: new Date(nextWeek.getTime() - DAY) })
    await bookshelf.knex('users').where('id', regular.id).update({ last_active_at: nextWeek })
    const result = await runWeekly({ now: nextWeek })
    expect(result.groups).to.equal(1)
    expect(await noticesFor(regular.id)).to.have.length(2)
  })

  it('skips spaces and counts no creator as a new member', async () => {
    const space = await factories.group({ type: 'space', parent_id: group.id, slug: `newcomers-space-${Date.now()}` }).save()
    const fresh = await factories.user().save()
    await fresh.joinGroup(space)
    const founder = await factories.user().save()
    const newGroup = await factories.group().save()
    await founder.joinGroup(newGroup, { joinSource: GroupMembership.JoinSource.CREATOR })

    const due = (await groupsWithNewMembers()).map(row => row.groupId)
    expect(due).to.not.include(String(space.id))
    expect(due).to.not.include(String(newGroup.id))
  })

  describe('the cap on groups per run', () => {
    let busy, quiet, busyReaders, quietReader

    before(async () => {
      busy = await factories.group().save()
      quiet = await factories.group().save()
      busyReaders = []
      for (let i = 0; i < 3; i++) {
        const reader = await factories.user().save()
        await join(reader, busy, { daysAgo: 30, activeDaysAgo: 1 })
        busyReaders.push(reader)
      }
      for (let i = 0; i < 2; i++) await join(await factories.user().save(), busy, { daysAgo: 1, activeDaysAgo: 1 })
      quietReader = await factories.user().save()
      await join(quietReader, quiet, { daysAgo: 30, activeDaysAgo: 1 })
      await join(await factories.user().save(), quiet, { daysAgo: 1, activeDaysAgo: 1 })
    })

    it('processes at most the capped number of groups, busiest first, inserting in batches', async () => {
      const result = await runWeekly({ maxGroups: 1, batchSize: 2 })
      expect(result).to.deep.equal({ groups: 1, notices: 3 })
      for (const reader of busyReaders) {
        const notices = await noticesFor(reader.id)
        expect(notices).to.have.length(1)
        expect(notices[0].activity.get('meta').newMemberCount).to.equal(2)
      }
      expect(await noticesFor(quietReader.id)).to.be.empty
    })

    it('serves a group the cap left out first the next week, ahead of busier groups', async () => {
      // More people join both groups during the next week, more of them in the busy one
      for (let i = 0; i < 2; i++) await join(await factories.user().save(), busy, { daysAgo: -6, activeDaysAgo: 1 })
      await join(await factories.user().save(), quiet, { daysAgo: -6, activeDaysAgo: 1 })
      const nextWeek = new Date(Date.now() + 7 * DAY)

      const due = (await groupsWithNewMembers({ now: nextWeek })).map(row => row.groupId)
      expect(due.indexOf(String(quiet.id))).to.be.below(due.indexOf(String(busy.id)))

      const result = await runWeekly({ now: nextWeek, maxGroups: 1 })
      expect(result.groups).to.equal(1)
      const notices = await noticesFor(quietReader.id)
      expect(notices).to.have.length(1)
      expect(notices[0].activity.get('meta').newMemberCount).to.equal(1)
      for (const reader of busyReaders) expect(await noticesFor(reader.id)).to.have.length(1)
    })
  })
})
