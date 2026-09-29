/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { createRequestHandler } from '../index'
import {
  createTrack,
  deleteTrack,
  duplicateTrack,
  enrollInTrack,
  leaveTrack,
  updateTrack
} from './track'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'

describe('track mutations', () => {
  let trackManager, member, group

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
  })

  before(async () => {
    trackManager = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await assignAdministrator(trackManager, group)
    await member.joinGroup(group)
  })

  after(async () => setup.clearDb())

  describe('createTrack', () => {
    it('creates a track linked to a space group', async () => {
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-create-${Date.now()}`
      }).save()
      const track = await createTrack(trackManager.id, {
        name: 'Onboarding',
        groupId: space.id
      })
      expect(String(track.get('group_id'))).to.equal(String(space.id))
      await space.refresh()
      expect(String(space.get('track_id'))).to.equal(String(track.id))
    })
  })

  describe('completion role', () => {
    it('rejects the Member role when creating or updating a track', async () => {
      const memberRole = await GroupRole.findMemberRole(group.id)
      const countTracks = async () => Number((await bookshelf.knex('tracks').count('id as count').first()).count)
      const before = await countTracks()
      await expect(createTrack(trackManager.id, { groupId: group.id, completionRoleId: String(memberRole.id) }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      expect(await countTracks()).to.equal(before)

      const track = await createTrack(trackManager.id, { groupId: group.id })
      await expect(updateTrack(trackManager.id, track.id, { completionRoleId: String(memberRole.id) }))
        .to.be.rejectedWith(MEMBER_ROLE_ERROR)
      await track.refresh()
      expect(track.get('completion_role_id')).to.equal(null)
    })

    it('still awards a system role on completion', async () => {
      const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
      const track = await createTrack(trackManager.id, { groupId: group.id, completionRoleId: String(hostRole.id) })
      expect(String(track.get('completion_role_id'))).to.equal(String(hostRole.id))
    })
  })

  describe('updateTrack and deleteTrack', () => {
    it('updates when user can manage tracks', async () => {
      const track = await createTrack(trackManager.id, {
        groupId: group.id
      })
      const updated = await updateTrack(trackManager.id, track.id, { actionDescriptor: 'Step' })
      expect(updated.get('action_descriptor')).to.equal('Step')
    })

    it('rejects update when user cannot manage tracks', async () => {
      const track = await createTrack(trackManager.id, {
        name: 'Protected',
        groupId: group.id
      })
      try {
        await updateTrack(member.id, track.id, { name: 'Hacked' })
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })

    it('deletes when user can manage tracks', async () => {
      // In its own space, as in the app: deleting archives the track's group, and an
      // archived top-level group would make the spaces the later tests use read-only
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-delete-${Date.now()}`
      }).save()
      const track = await createTrack(trackManager.id, {
        name: 'Trash me',
        groupId: space.id
      })
      await deleteTrack(trackManager.id, track.id)
      const gone = await Track.find(track.id)
      expect(gone).to.equal(null)
    })

    it('rejects delete when user cannot manage tracks', async () => {
      const track = await createTrack(trackManager.id, {
        name: 'Keep',
        groupId: group.id
      })
      try {
        await deleteTrack(member.id, track.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })
  })

  describe('duplicateTrack', () => {
    it('duplicates for a user with manage tracks responsibility', async () => {
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-dup-${Date.now()}`
      }).save()
      const track = await createTrack(trackManager.id, {
        name: 'Template',
        groupId: space.id
      })
      const copy = await duplicateTrack(trackManager.id, track.id)
      expect(copy.get('group_id')).to.exist
    })
  })

  describe('enrollInTrack and leaveTrack', () => {
    async function createPublishedTrackSpace (name) {
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-enroll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      }).save()
      const track = await createTrack(trackManager.id, {
        name,
        groupId: space.id
      })
      return { space, track }
    }

    it('enrolls when the track is published', async () => {
      const { space, track } = await createPublishedTrackSpace('Open')
      await enrollInTrack(member.id, track.id)
      const membership = await GroupMembership.forPair(member.id, space).fetch()
      expect(!!membership).to.equal(true)
      expect(membership.get('active')).to.equal(true)
      expect(membership.getSetting('joinSource')).to.equal('track')
    })

    it('rejects enrollment when the track is not published', async () => {
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-draft-${Date.now()}`,
        status: Group.Status.DRAFT
      }).save()
      const track = await createTrack(trackManager.id, {
        name: 'Draft',
        groupId: space.id
      })
      try {
        await enrollInTrack(member.id, track.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/not published/)
      }
    })

    it('clears enrollment on leaveTrack', async () => {
      const { space, track } = await createPublishedTrackSpace('Leave me')
      await enrollInTrack(member.id, track.id)
      await leaveTrack(member.id, track.id)
      const membership = await GroupMembership.forPair(member.id, space).fetch()
      expect(membership).to.equal(null)
      const inactive = await GroupMembership.forPair(member.id, space, { includeInactive: true }).fetch()
      expect(inactive.get('active')).to.equal(false)
    })
  })
  describe('learner progress and completion (D63)', () => {
    let space, track, actions, learner, second

    // Runs a document through the real schema, as the given user
    const run = async (userId, document) => {
      const { executionResult } = await createRequestHandler().inject({
        document,
        serverContext: { req: { session: { userId } } }
      })
      return executionResult
    }

    before(async () => {
      learner = await factories.user().save()
      second = await factories.user().save()
      await learner.joinGroup(group)
      await second.joinGroup(group)
      space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-progress-${Date.now()}`,
        name: 'Composting basics'
      }).save()
      await Group.setupSpaceViews(space.id, [], ['track-actions', 'members'])
      track = await createTrack(trackManager.id, { groupId: space.id })
      actions = []
      for (const name of ['Watch the intro', 'Build a bin']) {
        const action = await factories.post({ type: 'action', user_id: trackManager.id, name }).save()
        await action.groups().attach([space.id])
        await Track.addPost(action, await Track.find(track.id))
        actions.push(action)
      }
      await enrollInTrack(learner.id, track.id)
      await enrollInTrack(second.id, track.id)
    })

    const complete = async (user, action) => {
      await action.complete(user.id, JSON.stringify(['done']))
      await Post.checkCompletedTrack({ userId: user.id, postId: action.id })
    }
    const settingsOf = async user => (await GroupMembership.forPair(user.id, space.id).fetch()).get('settings')
    const learnerNotices = user => bookshelf.knex('activities')
      .where({ reader_id: user.id })
      .whereRaw('meta -> \'reasons\' @> ?::jsonb', [JSON.stringify(['trackCompletedLearner'])])

    it('records progress on the enrollment as actions are completed', async () => {
      await complete(learner, actions[0])
      const settings = await settingsOf(learner)
      expect(settings.actionsCompleted).to.equal(1)
      expect(new Date(settings.lastActionAt).getTime()).to.be.closeTo(Date.now(), 60000)
      expect(settings.completedAt).to.be.undefined
      expect(await learnerNotices(learner)).to.have.length(0)
    })

    it('tells the learner, in the app only, when they complete the track', async () => {
      await complete(learner, actions[1])
      const settings = await settingsOf(learner)
      expect(settings.actionsCompleted).to.equal(2)
      expect(settings.completedAt).to.be.a('string')

      const notices = await learnerNotices(learner)
      expect(notices).to.have.length(1)
      expect(String(notices[0].track_id)).to.equal(String(track.id))
      const media = await bookshelf.knex('notifications').where({ activity_id: notices[0].id }).pluck('medium')
      expect(media).to.deep.equal([Notification.MEDIUM.InApp])

      // Stewards are still told as before
      const stewardNotices = await bookshelf.knex('activities')
        .where({ reader_id: trackManager.id })
        .whereRaw('meta -> \'reasons\' @> ?::jsonb', [JSON.stringify(['trackCompleted'])])
      expect(stewardNotices.length).to.be.at.least(1)
    })

    const progressQuery = ({ completed } = {}) => `{
      track(id: "${track.id}") {
        enrolledUsers(${completed == null ? '' : `completed: ${completed}, `}first: 50) {
          total
          items { id actionsCompleted lastActionAt completedAt }
        }
      }
    }`
    const byId = result => Object.fromEntries(result.data.track.enrolledUsers.items.map(item => [item.id, item]))

    it('shows every learner\'s progress to the track\'s stewards', async () => {
      const result = await run(trackManager.id, progressQuery())
      expect(result.errors).to.be.undefined
      const people = byId(result)
      expect(people[learner.id].actionsCompleted).to.equal(2)
      expect(people[learner.id].lastActionAt).to.be.a('string')
      expect(people[second.id].actionsCompleted).to.equal(0)
      expect(people[second.id].lastActionAt).to.equal(null)
    })

    it('shows a learner only their own progress', async () => {
      const result = await run(second.id, progressQuery())
      expect(result.errors).to.be.undefined
      const people = byId(result)
      expect(people[second.id].actionsCompleted).to.equal(0)
      expect(people[learner.id].actionsCompleted).to.equal(null)
      expect(people[learner.id].lastActionAt).to.equal(null)
    })

    it('lets stewards list only the learners who have not finished', async () => {
      const notFinished = await run(trackManager.id, progressQuery({ completed: false }))
      expect(notFinished.errors).to.be.undefined
      expect(notFinished.data.track.enrolledUsers.items.map(item => item.id)).to.deep.equal([String(second.id)])
      expect(notFinished.data.track.enrolledUsers.total).to.equal(1)

      const finished = await run(trackManager.id, progressQuery({ completed: true }))
      expect(finished.data.track.enrolledUsers.items.map(item => item.id)).to.deep.equal([String(learner.id)])
    })
  })
})
