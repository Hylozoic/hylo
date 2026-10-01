/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'
import { createTrack, enrollInTrack } from '../../../api/graphql/mutations/track'

const migration = require('../../../migrations/20261011000200_track_progress_backfill')

describe('migration 20261011000200_track_progress_backfill', () => {
  let space, actions, started, notStarted, alreadyRecorded

  before(async () => {
    await setup.clearDb()
    mockify(Queue, 'classMethod', () => Promise.resolve())
    const steward = await factories.user().save()
    const group = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id, slug: `backfill-${Date.now()}` }).save()
    await Group.setupSpaceViews(space.id, [], ['track-actions'])
    const track = await createTrack(steward.id, { groupId: space.id })
    actions = []
    for (let i = 0; i < 3; i++) {
      const action = await factories.post({ type: 'action', user_id: steward.id }).save()
      await action.groups().attach([space.id])
      await Track.addPost(action, await Track.find(track.id))
      actions.push(action)
    }
    started = await factories.user().save()
    notStarted = await factories.user().save()
    alreadyRecorded = await factories.user().save()
    for (const user of [started, notStarted, alreadyRecorded]) {
      await group.addMembers([user.id])
      await enrollInTrack(user.id, track.id)
    }
    const completedAt = new Date('2026-09-01T10:00:00Z')
    for (const action of actions.slice(0, 2)) {
      await bookshelf.knex('posts_users').insert({ user_id: started.id, post_id: action.id, completed_at: completedAt, created_at: completedAt })
    }
    await bookshelf.knex('posts_users').insert({ user_id: alreadyRecorded.id, post_id: actions[0].id, completed_at: completedAt, created_at: completedAt })
    const recorded = await GroupMembership.forPair(alreadyRecorded.id, space.id).fetch()
    await recorded.save({ settings: { ...recorded.get('settings'), actionsCompleted: 3 } }, { patch: true })
  })

  after(async () => {
    unspyify(Queue, 'classMethod')
    await setup.clearDb()
  })

  const settingsOf = async user => (await GroupMembership.forPair(user.id, space.id).fetch()).get('settings')

  it('fills in progress from completed actions, once, leaving recorded progress alone', async () => {
    await migration.up(bookshelf.knex)

    const startedSettings = await settingsOf(started)
    expect(startedSettings.actionsCompleted).to.equal(2)
    expect(new Date(startedSettings.lastActionAt).toISOString()).to.equal('2026-09-01T10:00:00.000Z')
    const notStartedSettings = await settingsOf(notStarted)
    expect(notStartedSettings.actionsCompleted).to.equal(0)
    expect(notStartedSettings.lastActionAt).to.be.undefined
    expect((await settingsOf(alreadyRecorded)).actionsCompleted).to.equal(3)

    await migration.up(bookshelf.knex)
    expect(await settingsOf(started)).to.deep.equal(startedSettings)

    await migration.down(bookshelf.knex)
    expect(await settingsOf(started)).to.deep.equal(startedSettings)
  })
})
