/* eslint-disable no-unused-expressions */
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { paywallPreview, previewPostTitles } = require(root('api/models/track/preview'))
const { createRequestHandler } = require(root('api/graphql/index'))
/* global bookshelf, Group, GroupView, Post, Track */

describe('paywall preview', () => {
  let steward, outsider, group

  const addPost = async (targetGroup, attrs = {}) => {
    const post = await factories.post({ type: Post.Type.DISCUSSION, user_id: steward.id, description: 'Members-only body', created_at: new Date(), ...attrs }).save()
    await post.groups().attach(targetGroup)
    return post
  }

  const pin = async (targetGroup, post) => {
    const view = await GroupView.forge({ group_id: targetGroup.id, type: GroupView.Type.DISCUSSIONS, name: 'Discussions' }).save()
    await bookshelf.knex('group_view_pins').insert({ view_id: view.id, post_id: post.id })
  }

  beforeEach(async () => {
    await setup.clearDb()
    steward = await factories.user().save()
    outsider = await factories.user().save()
    group = await factories.group({ paywall: true, visibility: Group.Visibility.PUBLIC }).save()
  })

  it('shows titles of pinned, then recent, posts and nothing else', async () => {
    const older = await addPost(group, { name: 'Welcome to the season', created_at: new Date(Date.now() - 60000) })
    await addPost(group, { name: 'Planting schedule' })
    await pin(group, older)
    await addPost(group, { name: '', type: Post.Type.CHAT })
    await addPost(group, { name: 'Removed post', active: false })

    const preview = await paywallPreview(group, outsider.id)

    expect(preview).to.deep.equal({
      postTitles: ['Welcome to the season', 'Planting schedule'],
      actionTitles: [],
      numActions: null,
      numPeopleCompleted: null
    })
  })

  it('shows the preview to someone signed out when the group is public', async () => {
    await addPost(group, { name: 'Planting schedule' })

    const preview = await paywallPreview(group, null)

    expect(preview.postTitles).to.deep.equal(['Planting schedule'])
  })

  it('shows nothing when the steward turned the preview off', async () => {
    await addPost(group, { name: 'Planting schedule' })
    await group.save({ settings: { ...group.get('settings'), show_paywall_preview: false } }, { patch: true })

    expect(await paywallPreview(group, outsider.id)).to.equal(null)
  })

  it('shows nothing when the group has no paywall', async () => {
    await group.save({ paywall: false }, { patch: true })

    expect(await paywallPreview(group, outsider.id)).to.equal(null)
  })

  it('shows nothing to someone who cannot see the group', async () => {
    const hidden = await factories.group({ paywall: true, visibility: Group.Visibility.HIDDEN }).save()
    await addPost(hidden, { name: 'Secret plans' })

    expect(await paywallPreview(hidden, outsider.id)).to.equal(null)
    expect(await paywallPreview(hidden, null)).to.equal(null)
  })

  it('limits the titles', async () => {
    for (let i = 0; i < 8; i++) {
      await addPost(group, { name: `Post ${i}` })
    }

    expect(await previewPostTitles(group)).to.have.length(5)
  })

  describe('through GraphQL', () => {
    let handler

    const queryPreview = async (viewer, targetGroup) => {
      const req = factories.mock.request()
      req.url = '/noo/graphql'
      req.method = 'POST'
      req.headers = { 'Content-Type': 'application/json' }
      req.session = { userId: viewer.id, destroy: () => {} }
      req.user = viewer
      const { executionResult } = await handler.inject({
        document: `{ group(id: "${targetGroup.id}") { paywallPreview { postTitles actionTitles numActions numPeopleCompleted } } }`,
        serverContext: { req, res: factories.mock.response() }
      })
      return executionResult
    }

    before(() => {
      handler = createRequestHandler()
    })

    it('returns only titles to someone who has not bought access', async () => {
      await addPost(group, { name: 'Planting schedule' })

      const result = await queryPreview(outsider, group)

      expect(result.errors).to.equal(undefined)
      expect(result.data.group.paywallPreview).to.deep.equal({
        postTitles: ['Planting schedule'],
        actionTitles: [],
        numActions: null,
        numPeopleCompleted: null
      })
    })

    it('returns nothing when the steward turned the preview off', async () => {
      await addPost(group, { name: 'Planting schedule' })
      await group.save({ settings: { ...group.get('settings'), show_paywall_preview: false } }, { patch: true })

      const result = await queryPreview(outsider, group)

      expect(result.data.group.paywallPreview).to.equal(null)
    })
  })

  describe('for a track space', () => {
    let space, track

    beforeEach(async () => {
      await steward.joinGroup(group)
      space = await factories.group({
        type: 'space',
        parent_id: group.id,
        paywall: true,
        visibility: Group.Visibility.PROTECTED,
        slug: `preview-track-${Date.now()}`
      }).save()
      const created = await Track.create({ group_id: space.id })
      track = await Track.where({ id: created.id }).fetch()
      await space.save({ status: 'published', track_id: track.id }, { patch: true })
      await Group.setupSpaceViews(space.id, ['action'], ['track-actions', 'members', 'welcome'])
      for (const name of ['Read the guide', 'Plant your first bed']) {
        const action = await factories.post({ type: Post.Type.ACTION, user_id: steward.id, name, description: 'Locked details' }).save()
        await action.groups().attach(space)
        await Track.addPost(action, track)
      }
      await track.save({ num_people_completed: 3 }, { patch: true })
      await outsider.joinGroup(group)
    })

    it('shows the locked action titles and counts to a member of the parent group', async () => {
      const preview = await paywallPreview(space, outsider.id)

      expect(preview).to.deep.equal({
        postTitles: [],
        actionTitles: ['Read the guide', 'Plant your first bed'],
        numActions: 2,
        numPeopleCompleted: 3
      })
    })

    it('shows nothing when the parent group turned the preview off', async () => {
      await group.save({ settings: { ...group.get('settings'), show_paywall_preview: false } }, { patch: true })

      expect(await paywallPreview(space, outsider.id)).to.equal(null)
    })

    it('shows nothing to someone outside the parent group', async () => {
      const stranger = await factories.user().save()

      expect(await paywallPreview(space, stranger.id)).to.equal(null)
    })
  })
})
