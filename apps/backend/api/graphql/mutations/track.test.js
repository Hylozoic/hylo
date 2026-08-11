/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'
import { assignCoordinator } from '../../../test/setup/roleHelpers'
import {
  createTrack,
  deleteTrack,
  duplicateTrack,
  enrollInTrack,
  leaveTrack,
  updateTrack
} from './track'

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
    await assignCoordinator(trackManager, group)
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
        groupId: space.id,
        publishedAt: Date.now().toString()
      })
      expect(track.get('name')).to.equal('Onboarding')
      expect(String(track.get('group_id'))).to.equal(String(space.id))
      await space.refresh()
      expect(String(space.get('track_id'))).to.equal(String(track.id))
    })
  })

  describe('updateTrack and deleteTrack', () => {
    it('updates when user can manage tracks', async () => {
      const track = await createTrack(trackManager.id, {
        name: 'Original',
        groupId: group.id
      })
      const updated = await updateTrack(trackManager.id, track.id, { name: 'Renamed' })
      expect(updated.get('name')).to.equal('Renamed')
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
      const track = await createTrack(trackManager.id, {
        name: 'Trash me',
        groupId: group.id
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
      expect(copy.get('name')).to.match(/\(copy\)/)
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
        groupId: space.id,
        publishedAt: Date.now().toString()
      })
      return { space, track }
    }

    it('enrolls when the track is published', async () => {
      const { space, track } = await createPublishedTrackSpace('Open')
      await enrollInTrack(member.id, track.id)
      const membership = await GroupMembership.forPair(member.id, space).fetch()
      expect(!!membership).to.equal(true)
      expect(membership.get('active')).to.equal(true)
    })

    it('rejects enrollment when the track is not published', async () => {
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `track-space-draft-${Date.now()}`
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
})
