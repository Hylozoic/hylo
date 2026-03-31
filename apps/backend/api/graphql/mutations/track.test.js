import '../../../test/setup'
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'
import {
  createTrack,
  deleteTrack,
  duplicateTrack,
  enrollInTrack,
  leaveTrack,
  updateTrack,
  updateTrackActionOrder
} from './track'

async function assignCoordinator (user, group) {
  await user.joinGroup(group)
  await new MemberCommonRole({
    user_id: user.id,
    group_id: group.id,
    common_role_id: CommonRole.ROLES.Coordinator
  }).save()
}

describe('track mutations', () => {
  let coordinator, member, group

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
  })

  before(async () => {
    coordinator = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await assignCoordinator(coordinator, group)
    await member.joinGroup(group)
  })

  after(async () => setup.clearDb())

  describe('createTrack', () => {
    it('creates a track linked to groups', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Onboarding',
        groupIds: [group.id],
        publishedAt: Date.now().toString()
      })
      expect(track.get('name')).to.equal('Onboarding')
      const groups = await track.groups().fetch()
      expect(groups.pluck('id')).to.include(group.id)
    })
  })

  describe('updateTrack and deleteTrack', () => {
    it('updates when user can manage tracks', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Original',
        groupIds: [group.id]
      })
      const updated = await updateTrack(coordinator.id, track.id, { name: 'Renamed' })
      expect(updated.get('name')).to.equal('Renamed')
    })

    it('rejects update when user cannot manage tracks', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Protected',
        groupIds: [group.id]
      })
      try {
        await updateTrack(member.id, track.id, { name: 'Hacked' })
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })

    it('deletes when user can manage tracks', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Trash me',
        groupIds: [group.id]
      })
      await deleteTrack(coordinator.id, track.id)
      const gone = await Track.find(track.id)
      expect(gone).to.not.exist
    })

    it('rejects delete when user cannot manage tracks', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Keep',
        groupIds: [group.id]
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
    it('duplicates for a track manager', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Template',
        groupIds: [group.id]
      })
      const copy = await duplicateTrack(coordinator.id, track.id)
      expect(copy.get('name')).to.match(/\(copy\)/)
    })
  })

  describe('enrollInTrack and leaveTrack', () => {
    it('enrolls when the track is published', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Open',
        groupIds: [group.id],
        publishedAt: Date.now().toString()
      })
      await enrollInTrack(member.id, track.id)
      const tu = await TrackUser.where({ track_id: track.id, user_id: member.id }).fetch()
      expect(tu.get('enrolled_at')).to.exist
    })

    it('rejects enrollment when the track is not published', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Draft',
        groupIds: [group.id]
      })
      try {
        await enrollInTrack(member.id, track.id)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/not published/)
      }
    })

    it('clears enrollment on leaveTrack', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Leave me',
        groupIds: [group.id],
        publishedAt: Date.now().toString()
      })
      await enrollInTrack(member.id, track.id)
      await leaveTrack(member.id, track.id)
      const tu = await TrackUser.where({ track_id: track.id, user_id: member.id }).fetch()
      expect(tu.get('enrolled_at')).to.equal(null)
    })
  })

  describe('updateTrackActionOrder', () => {
    it('moves an action within the track order', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Actions',
        groupIds: [group.id]
      })
      const a1 = await factories.post({ type: Post.Type.ACTION, user_id: coordinator.id }).save()
      const a2 = await factories.post({ type: Post.Type.ACTION, user_id: coordinator.id }).save()
      await a1.groups().attach(group)
      await a2.groups().attach(group)
      await Track.addPost(a1, track)
      await Track.addPost(a2, track)

      const tp2 = await TrackPost.where({ track_id: track.id, post_id: a2.id }).fetch()
      const beforeOrder = tp2.get('sort_order')
      const targetOrder = Math.max(0, beforeOrder - 1)
      await updateTrackActionOrder(coordinator.id, track.id, a2.id, targetOrder)
      const tp2After = await TrackPost.where({ track_id: track.id, post_id: a2.id }).fetch()
      expect(tp2After.get('sort_order')).to.equal(targetOrder)
    })

    it('rejects when user cannot manage tracks', async () => {
      const track = await createTrack(coordinator.id, {
        name: 'Locked order',
        groupIds: [group.id]
      })
      const a1 = await factories.post({ type: Post.Type.ACTION, user_id: coordinator.id }).save()
      await a1.groups().attach(group)
      await Track.addPost(a1, track)
      try {
        await updateTrackActionOrder(member.id, track.id, a1.id, 0)
        expect.fail('should throw')
      } catch (e) {
        expect(e.message).to.match(/do not have permission/)
      }
    })
  })
})
