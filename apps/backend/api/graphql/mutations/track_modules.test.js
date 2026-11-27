/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { spyify, unspyify } from '../../../test/setup/helpers'
import { assignAdministrator } from '../../../test/setup/roleHelpers'
import { createTrack, duplicateTrack } from './track'
import {
  createTrackModule,
  deleteTrackModule,
  updateTrackModule,
  updateTrackOutline
} from './track_modules'

describe('track module mutations', () => {
  let steward, member, group, space, track, view, posts

  /** The track's top-level outline as readable strings, e.g. ['p0', 'm1[p1,p2]']. */
  async function outline (viewId = view.id) {
    const rows = await bookshelf.knex('collections_posts').where({ view_id: viewId }).orderBy('order')
    const modules = await bookshelf.knex('track_modules').where({ view_id: viewId }).orderBy('order')
    const postName = row => `p${posts.findIndex(p => String(p.id) === String(row.post_id))}`
    const entries = [
      ...modules.map(m => ({
        order: m.order,
        label: `${m.title}[${rows.filter(r => String(r.module_id) === String(m.id)).map(postName).join(',')}]`
      })),
      ...rows.filter(r => !r.module_id).map(r => ({ order: r.order, label: postName(r) }))
    ]
    return entries.sort((a, b) => a.order - b.order).map(e => e.label)
  }

  beforeEach(() => {
    spyify(Queue, 'classMethod', () => Promise.resolve())
  })

  afterEach(() => {
    unspyify(Queue, 'classMethod')
  })

  before(async () => {
    steward = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await assignAdministrator(steward, group)
    await member.joinGroup(group)

    space = await factories.group({
      type: 'space',
      parent_id: group.id,
      slug: `track-modules-${Date.now()}`
    }).save()
    track = await createTrack(steward.id, { groupId: space.id })
    await Group.setupSpaceViews(space.id, [], ['track-actions'])
    view = await space.trackActionsView().fetch()

    posts = []
    for (let i = 0; i < 4; i++) {
      const post = await factories.post({ type: 'action', user_id: steward.id }).save()
      await post.groups().attach([space.id])
      await Track.addPost(post, track)
      posts.push(post)
    }
  })

  after(async () => setup.clearDb())

  it('does not let a member without responsibilities edit the outline', async () => {
    await expect(createTrackModule(member.id, view.id, { title: 'Nope' })).to.be.rejectedWith(/permission/)
  })

  it('adds a module at the end of the outline', async () => {
    const m1 = await createTrackModule(steward.id, view.id, { title: 'm1', description: 'First week' })
    expect(m1.get('description')).to.equal('First week')
    expect(await outline()).to.deep.equal(['p0', 'p1', 'p2', 'p3', 'm1[]'])
  })

  it('saves a new outline, moving actions into and out of modules', async () => {
    const m1 = await TrackModule.where({ view_id: view.id, title: 'm1' }).fetch()
    const m2 = await createTrackModule(steward.id, view.id, { title: 'm2' })

    await updateTrackOutline(steward.id, view.id, [
      { postId: posts[0].id },
      { moduleId: m1.id, postIds: [posts[2].id, posts[1].id] },
      { moduleId: m2.id, postIds: [] },
      { postId: posts[3].id }
    ])
    expect(await outline()).to.deep.equal(['p0', 'm1[p2,p1]', 'm2[]', 'p3'])

    // Sorting every action by order still gives the flat order of the track
    const flat = await space.actionPosts()
    expect(flat.map(p => String(p.id))).to.deep.equal([posts[0], posts[2], posts[1], posts[3]].map(p => String(p.id)))
  })

  it('keeps actions the caller left out, after the ones it sent', async () => {
    const m1 = await TrackModule.where({ view_id: view.id, title: 'm1' }).fetch()
    await updateTrackOutline(steward.id, view.id, [
      { postId: posts[3].id },
      { moduleId: m1.id, postIds: [posts[1].id] }
    ])
    expect(await outline()).to.deep.equal(['p3', 'm1[p1,p2]', 'm2[]', 'p0'])
  })

  it('rejects posts and modules from other tracks', async () => {
    const stranger = await factories.post({ type: 'action', user_id: steward.id }).save()
    await expect(updateTrackOutline(steward.id, view.id, [{ postId: stranger.id }])).to.be.rejectedWith(/Not a valid post/)
    await expect(updateTrackOutline(steward.id, view.id, [{ moduleId: 999999, postIds: [] }])).to.be.rejectedWith(/Not a valid module/)
  })

  it('puts a new action at the end of its module', async () => {
    const m1 = await TrackModule.where({ view_id: view.id, title: 'm1' }).fetch()
    const m2 = await TrackModule.where({ view_id: view.id, title: 'm2' }).fetch()
    for (const trackModule of [m1, m2]) {
      const post = await factories.post({ type: 'action', user_id: steward.id }).save()
      await Track.addPost(post, track, { moduleId: trackModule.id })
      posts.push(post)
    }
    expect(await outline()).to.deep.equal(['p3', 'm1[p1,p2,p4]', 'm2[p5]', 'p0'])
  })

  it('updates the title and the opening rule', async () => {
    const m2 = await TrackModule.where({ view_id: view.id, title: 'm2' }).fetch()
    const opensAt = new Date('2030-01-07T00:00:00.000Z')
    let updated = await updateTrackModule(steward.id, m2.id, { opensAt })
    expect(updated.opensAt().toISOString()).to.equal(opensAt.toISOString())
    expect(updated.opensAfterPrevious()).to.be.false

    updated = await updateTrackModule(steward.id, m2.id, { opensAt: null, opensAfterPrevious: true })
    expect(updated.opensAt()).to.be.null
    expect(updated.opensAfterPrevious()).to.be.true
    expect(updated.get('title')).to.equal('m2')
  })

  it('copies modules when a track is duplicated', async () => {
    const copy = await duplicateTrack(steward.id, track.id)
    const copySpace = await copy.group().fetch()
    const copyView = await copySpace.trackActionsView().fetch()
    const modules = await bookshelf.knex('track_modules').where({ view_id: copyView.id }).orderBy('order')
    expect(modules.map(m => m.title)).to.deep.equal(['m1', 'm2'])
    expect(modules[1].settings.opens_after_previous).to.be.true
    const rows = await bookshelf.knex('collections_posts').where({ view_id: copyView.id }).orderBy('order')
    const moduleTitles = rows.map(r => r.module_id ? modules.find(m => String(m.id) === String(r.module_id)).title : null)
    expect(moduleTitles.filter(title => title === 'm1')).to.have.length(3)
    expect(moduleTitles.filter(title => title === 'm2')).to.have.length(1)
    expect(moduleTitles.filter(title => title === null)).to.have.length(2)
  })

  it('removes a module and keeps its actions where the module was', async () => {
    const m1 = await TrackModule.where({ view_id: view.id, title: 'm1' }).fetch()
    await deleteTrackModule(steward.id, m1.id)
    const after = await outline()
    expect(after).to.include.members(['p1', 'p2', 'p4', 'm2[p5]'])
    expect(after).to.have.length(6)
    // The first action of the removed module takes the module's place
    expect(after.slice(0, 3)).to.deep.equal(['p3', 'p1', 'm2[p5]'])
  })
})
