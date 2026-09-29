/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import {
  ACTIVITY_WINDOW_DAYS,
  ExplorerStatus,
  MIN_MEMBERS,
  explorerReviewList,
  explorerStatusForNewGroup,
  reviewExplorerGroup
} from './explorerReview'

const migration = require('../../../migrations/20261004000000_group_explorer_review')

const PUBLIC = 2
const PROTECTED = 1
const DAY = 24 * 60 * 60 * 1000

async function makeMembers (group, count) {
  const users = []
  for (let i = 0; i < count; i++) {
    users.push(await factories.user().save())
  }
  await group.addMembers(users.map(u => u.id))
  return users
}

async function addPost (group, user, daysAgo, attrs = {}) {
  const createdAt = new Date(Date.now() - daysAgo * DAY)
  const post = await factories.post({ user_id: user.id, type: 'discussion', created_at: createdAt, updated_at: createdAt, ...attrs }).save()
  await bookshelf.knex('groups_posts').insert({ group_id: group.id, post_id: post.id })
  return post
}

async function explorerRow (groupId) {
  return bookshelf.knex('groups').where('id', groupId)
    .first('allow_in_public', 'explorer_status', 'explorer_reviewed_at', 'explorer_reviewed_by_id')
}

describe('explorerReview', () => {
  let admin, member, oldAdmins

  before(async () => {
    await setup.clearDb()
    admin = await factories.user().save()
    member = await factories.user().save()
    oldAdmins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = String(admin.id)
  })

  after(() => {
    process.env.HYLO_ADMINS = oldAdmins
  })

  describe('explorerStatusForNewGroup', () => {
    it('marks Public top-level groups pending', () => {
      expect(explorerStatusForNewGroup({ visibility: PUBLIC })).to.equal(ExplorerStatus.PENDING)
      expect(explorerStatusForNewGroup({ visibility: PUBLIC, type: 'farm' })).to.equal(ExplorerStatus.PENDING)
    })

    it('leaves groups that are not Public, and spaces, out of the review list', () => {
      expect(explorerStatusForNewGroup({ visibility: PROTECTED })).to.be.null
      expect(explorerStatusForNewGroup({ visibility: 0 })).to.be.null
      expect(explorerStatusForNewGroup({ visibility: PUBLIC, type: 'space' })).to.be.null
    })
  })

  describe('Group.create', () => {
    it('queues a new Public group for review without listing it', async () => {
      const group = await Group.create(member.id, { name: 'Open Garden', slug: `open-garden-${Date.now()}`, visibility: PUBLIC })
      const row = await explorerRow(group.id)
      expect(row.explorer_status).to.equal(ExplorerStatus.PENDING)
      expect(row.allow_in_public).to.equal(false)
    })

    it('does not queue a group that is not Public', async () => {
      const group = await Group.create(member.id, { name: 'Quiet Garden', slug: `quiet-garden-${Date.now()}`, visibility: PROTECTED })
      const row = await explorerRow(group.id)
      expect(row.explorer_status).to.be.null
    })
  })

  describe('Group.update', () => {
    it('queues a group that switches to Public', async () => {
      const group = await Group.create(member.id, { name: 'Later Public', slug: `later-public-${Date.now()}`, visibility: PROTECTED })
      await group.update({ visibility: PUBLIC }, member.id)
      expect((await explorerRow(group.id)).explorer_status).to.equal(ExplorerStatus.PENDING)
    })

    it('leaves a listed group alone when it switches to Public', async () => {
      const group = await factories.group({ visibility: PROTECTED, allow_in_public: true, explorer_status: ExplorerStatus.APPROVED }).save()
      await group.update({ visibility: PUBLIC }, member.id)
      expect((await explorerRow(group.id)).explorer_status).to.equal(ExplorerStatus.APPROVED)
    })

    it('does not queue a group whose visibility does not change', async () => {
      const group = await factories.group({ visibility: PUBLIC }).save()
      await group.update({ description: 'new words' }, member.id)
      expect((await explorerRow(group.id)).explorer_status).to.be.null
    })
  })

  describe('explorerReviewList', () => {
    let lively, quiet, hiddenPending

    before(async () => {
      lively = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      const members = await makeMembers(lively, MIN_MEMBERS)
      await addPost(lively, members[0], 3)
      await addPost(lively, members[1], ACTIVITY_WINDOW_DAYS + 20)
      quiet = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      await makeMembers(quiet, 1)
      hiddenPending = await factories.group({ visibility: PROTECTED, explorer_status: ExplorerStatus.PENDING }).save()
    })

    it('is only for Hylo admins', async () => {
      await expect(explorerReviewList(member.id)).to.be.rejectedWith(/Admin access required/)
    })

    it('lists pending Public groups with their quality and a recommendation', async () => {
      const list = await explorerReviewList(admin.id)
      const ids = list.pending.map(g => String(g.id))
      expect(ids).to.include(String(lively.id))
      expect(ids).to.include(String(quiet.id))
      expect(ids).not.to.include(String(hiddenPending.id))

      const livelyItem = list.pending.find(g => String(g.id) === String(lively.id))
      expect(livelyItem.memberCount).to.equal(MIN_MEMBERS)
      expect(livelyItem.recentPostCount).to.equal(1)
      expect(livelyItem.meetsBar).to.be.true

      const quietItem = list.pending.find(g => String(g.id) === String(quiet.id))
      expect(quietItem.meetsBar).to.be.false
      expect(list.minMembers).to.equal(MIN_MEMBERS)
      expect(list.activityWindowDays).to.equal(ACTIVITY_WINDOW_DAYS)
    })
  })

  describe('reviewExplorerGroup', () => {
    it('is only for Hylo admins', async () => {
      const group = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      await expect(reviewExplorerGroup(member.id, group.id, 'approve')).to.be.rejectedWith(/Admin access required/)
      expect((await explorerRow(group.id)).allow_in_public).to.equal(false)
    })

    it('approve lists the group in the Explorer and records the reviewer', async () => {
      const group = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      const result = await reviewExplorerGroup(admin.id, group.id, 'approve')
      expect(result.status).to.equal(ExplorerStatus.APPROVED)
      const row = await explorerRow(group.id)
      expect(row.allow_in_public).to.equal(true)
      expect(row.explorer_status).to.equal(ExplorerStatus.APPROVED)
      expect(String(row.explorer_reviewed_by_id)).to.equal(String(admin.id))
      expect(row.explorer_reviewed_at).to.exist
    })

    it('deny keeps the group out of the Explorer', async () => {
      const group = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      await reviewExplorerGroup(admin.id, group.id, 'deny')
      const row = await explorerRow(group.id)
      expect(row.allow_in_public).to.equal(false)
      expect(row.explorer_status).to.equal(ExplorerStatus.DENIED)
    })

    it('keep leaves a listed group listed', async () => {
      const group = await factories.group({ visibility: PUBLIC, allow_in_public: true, explorer_status: ExplorerStatus.KEEP_OR_UNLIST }).save()
      await reviewExplorerGroup(admin.id, group.id, 'keep')
      const row = await explorerRow(group.id)
      expect(row.allow_in_public).to.equal(true)
      expect(row.explorer_status).to.equal(ExplorerStatus.KEPT)
    })

    it('unlist takes a listed group out of the Explorer', async () => {
      const group = await factories.group({ visibility: PUBLIC, allow_in_public: true, explorer_status: ExplorerStatus.KEEP_OR_UNLIST }).save()
      await reviewExplorerGroup(admin.id, group.id, 'unlist')
      const row = await explorerRow(group.id)
      expect(row.allow_in_public).to.equal(false)
      expect(row.explorer_status).to.equal(ExplorerStatus.UNLISTED)
    })

    it('rejects an unknown decision', async () => {
      const group = await factories.group({ visibility: PUBLIC, explorer_status: ExplorerStatus.PENDING }).save()
      await expect(reviewExplorerGroup(admin.id, group.id, 'feature')).to.be.rejectedWith(/Unknown review decision/)
    })
  })

  describe('one-time review of existing Public groups', () => {
    let passingUnlisted, failingUnlisted, failingListed, passingListed, passingProtected, passingSpace, alreadyReviewed

    async function passing (attrs) {
      const group = await factories.group(attrs).save()
      const members = await makeMembers(group, MIN_MEMBERS)
      await addPost(group, members[0], 5)
      return group
    }

    before(async () => {
      await setup.clearDb()
      passingUnlisted = await passing({ visibility: PUBLIC })
      failingUnlisted = await factories.group({ visibility: PUBLIC }).save()
      const lonely = await makeMembers(failingUnlisted, MIN_MEMBERS)
      await addPost(failingUnlisted, lonely[0], ACTIVITY_WINDOW_DAYS + 5)
      failingListed = await factories.group({ visibility: PUBLIC, allow_in_public: true }).save()
      const few = await makeMembers(failingListed, MIN_MEMBERS - 1)
      await addPost(failingListed, few[0], 2)
      passingListed = await passing({ visibility: PUBLIC, allow_in_public: true })
      passingProtected = await passing({ visibility: PROTECTED })
      passingSpace = await passing({ visibility: PUBLIC, type: 'space' })
      alreadyReviewed = await passing({ visibility: PUBLIC, explorer_status: ExplorerStatus.DENIED })
    })

    it('uses the same bar as the review list', () => {
      expect(migration.MIN_MEMBERS).to.equal(MIN_MEMBERS)
      expect(migration.ACTIVITY_WINDOW_DAYS).to.equal(ACTIVITY_WINDOW_DAYS)
    })

    it('queues unlisted groups that pass the bar and asks about listed groups that no longer do', async () => {
      const counts = await migration.backfill(bookshelf.knex)
      expect(counts).to.deep.equal({ pending: 1, keepOrUnlist: 1 })

      expect((await explorerRow(passingUnlisted.id)).explorer_status).to.equal(ExplorerStatus.PENDING)
      expect((await explorerRow(failingUnlisted.id)).explorer_status).to.be.null
      expect((await explorerRow(failingListed.id)).explorer_status).to.equal(ExplorerStatus.KEEP_OR_UNLIST)
      expect((await explorerRow(passingListed.id)).explorer_status).to.be.null
      expect((await explorerRow(passingProtected.id)).explorer_status).to.be.null
      expect((await explorerRow(passingSpace.id)).explorer_status).to.be.null
      expect((await explorerRow(alreadyReviewed.id)).explorer_status).to.equal(ExplorerStatus.DENIED)
    })

    it('shows the keep-or-unlist groups in their own section', async () => {
      const list = await explorerReviewList(admin.id)
      expect(list.keepOrUnlist.map(g => String(g.id))).to.deep.equal([String(failingListed.id)])
      expect(list.keepOrUnlist[0].meetsBar).to.be.false
    })
  })
})
