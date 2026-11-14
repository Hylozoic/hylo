/* eslint-disable no-unused-expressions */
/* global Group, GroupView, HyloProSubscription, Post, bookshelf */
import factories from '../../../test/setup/factories'
import { createGroupView, updateGroupView, deleteGroupView, designGroupViewTurn, suggestGroupViews } from './group_views'
import { buildGroupDigest, describePickedPosts, digestPostIds, postIdsInGroup } from '../../../lib/groupDigest'

describe('designed views', () => {
  let admin, member, group

  const design = {
    blocks: [
      { type: 'heading', text: 'Welcome', level: 1 },
      { type: 'posts', title: 'Latest', postTypes: ['discussion'], limit: 4, layout: 'list' }
    ]
  }
  const storedDesign = { version: 1, blocks: design.blocks }

  const grantPro = () => HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active' }).save()
  const removePro = () => bookshelf.knex('hylo_pro_subscriptions').where('group_id', group.id).del()
  const create = (userId, settings = { design }) =>
    createGroupView({ userId, groupId: group.id, type: 'designed', name: 'Welcome', settings })

  before(async () => {
    admin = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    await admin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  beforeEach(async () => {
    await removePro()
    await grantPro()
  })

  describe('createGroupView and updateGroupView', () => {
    it('stores a valid design in settings.design, with defaults filled in and nothing else', async () => {
      const view = await create(admin.id, { design: { blocks: [{ type: 'heading', text: ' Hi ' }] }, extra: 'dropped' })
      expect(view.get('type')).to.equal('designed')
      expect(view.get('settings')).to.deep.equal({
        design: { version: 1, blocks: [{ type: 'heading', text: 'Hi', level: 2 }] }
      })
      expect(view.get('order')).to.be.a('number')
    })

    it('rejects a design with anything but known blocks, and a missing design', async () => {
      await expect(create(admin.id, { design: { blocks: [{ type: 'html', html: '<script>x</script>' }] } }))
        .to.be.rejectedWith(/Invalid design: .*unknown block type "html"/)
      await expect(create(admin.id, {})).to.be.rejectedWith(/Invalid design/)
      await expect(create(admin.id, null)).to.be.rejectedWith(/Invalid design/)
    })

    it('needs the Administration responsibility', async () => {
      await expect(create(member.id)).to.be.rejectedWith(/permission/)
    })

    it('replaces the design on update and validates it again', async () => {
      const view = await create(admin.id)
      const next = { blocks: [{ type: 'divider' }] }
      const updated = await updateGroupView({ userId: admin.id, id: view.id, settings: { design: next } })
      expect(updated.get('settings')).to.deep.equal({ design: { version: 1, blocks: [{ type: 'divider' }] } })

      await expect(updateGroupView({ userId: admin.id, id: view.id, settings: { design: { blocks: [{ type: 'nope' }] } } }))
        .to.be.rejectedWith(/Invalid design/)
      expect((await GroupView.where({ id: view.id }).fetch()).get('settings').design.blocks).to.deep.equal([{ type: 'divider' }])
    })

    it('only saves parts of posts that are in the group', async () => {
      const post = await factories.post({ user_id: admin.id, active: true, type: 'event', name: 'Potluck' }).save()
      await bookshelf.knex('groups_posts').insert({ group_id: group.id, post_id: post.id })
      const outside = await factories.post({ user_id: admin.id, active: true, type: 'event', name: 'Elsewhere' }).save()

      const view = await create(admin.id, { design: { blocks: [{ type: 'postPart', postId: post.id, part: 'event' }] } })
      expect(view.get('settings').design.blocks).to.deep.equal([{ type: 'postPart', postId: String(post.id), part: 'event' }])

      await expect(create(admin.id, { design: { blocks: [{ type: 'postPart', postId: outside.id, part: 'everything' }] } }))
        .to.be.rejectedWith(new RegExp(`post ${outside.id} is not in this group`))
      await expect(updateGroupView({ userId: admin.id, id: view.id, settings: { design: { blocks: [{ type: 'postPart', postId: outside.id }] } } }))
        .to.be.rejectedWith(/is not in this group/)
    })

    it('does not touch other view types', async () => {
      const view = await createGroupView({ userId: admin.id, groupId: group.id, type: 'custom', name: 'Mine', settings: { postTypes: ['offer'] } })
      expect(view.get('settings')).to.deep.equal({ postTypes: ['offer'] })
    })
  })

  describe('without Hylo Pro', () => {
    it('refuses to create a designed view or change its design', async () => {
      const view = await create(admin.id)
      await removePro()

      await expect(create(admin.id)).to.be.rejectedWith(/part of Hylo Pro/)
      await expect(updateGroupView({ userId: admin.id, id: view.id, settings: { design } }))
        .to.be.rejectedWith(/part of Hylo Pro/)
    })

    it('keeps a view made with Pro, and still lets it be renamed and deleted', async () => {
      const view = await create(admin.id)
      await removePro()

      const renamed = await updateGroupView({ userId: admin.id, id: view.id, name: 'Start here' })
      expect(renamed.get('name')).to.equal('Start here')
      expect(renamed.get('settings')).to.deep.equal({ design: storedDesign })

      await deleteGroupView(admin.id, view.id)
      expect(await GroupView.where({ id: view.id }).fetch()).to.not.exist
    })
  })

  describe('designGroupViewTurn', () => {
    const messages = [{ role: 'user', text: 'A welcome page' }]
    const turn = { reply: 'Here you go.', view: storedDesign, usage: { inputTokens: 1 } }
    const deps = overrides => ({
      isConfigured: () => true,
      withinLimit: async () => true,
      designTurn: async () => turn,
      ...overrides
    })
    const run = (userId, args = {}, d = deps()) => designGroupViewTurn({ userId, groupId: group.id, messages, ...args }, d)

    it('passes the group, the conversation and the checked current design to the model, and saves nothing', async () => {
      let received
      const before = await GroupView.where({ group_id: group.id }).count()
      const result = await run(admin.id, { currentView: design }, deps({ designTurn: async request => { received = request; return turn } }))

      expect(result).to.deep.equal(turn)
      expect(received.group.name).to.equal(group.get('name'))
      expect(received.messages).to.deep.equal(messages)
      expect(received.currentView).to.deep.equal(storedDesign)
      expect(received.images).to.deep.equal([])
      expect(received.documents).to.deep.equal([])
      expect(received.pickedPostsSummary).to.equal('')
      expect(received.groupSummary).to.contain(`Group name: ${group.get('name')}`)
      expect(await GroupView.where({ group_id: group.id }).count()).to.equal(before)
    })

    it('refuses members, groups without Pro, bad input and a reached limit, before any model call', async () => {
      let called = false
      const d = overrides => deps({ designTurn: async () => { called = true; return turn }, ...overrides })

      await expect(run(member.id, {}, d())).to.be.rejectedWith(/permission/)
      await expect(run(admin.id, { messages: [] }, d())).to.be.rejectedWith(/what the page should be for/)
      await expect(run(admin.id, { currentView: { blocks: [{ type: 'html' }] } }, d())).to.be.rejectedWith(/Invalid design/)
      await expect(run(admin.id, { images: [{ url: 'http://example.org/a.jpg' }] }, d())).to.be.rejectedWith(/https address/)
      await expect(run(admin.id, {}, d({ isConfigured: () => false }))).to.be.rejectedWith(/not set up/)
      await expect(run(admin.id, {}, d({ withinLimit: async () => false }))).to.be.rejectedWith(/try again later/)
      await removePro()
      await expect(run(admin.id, {}, d())).to.be.rejectedWith(/part of Hylo Pro/)
      expect(called).to.equal(false)
    })

    it('only shows the model files on Hylo storage: other images can be placed but not seen, other documents are refused', async () => {
      let received
      const d = deps({
        isHostedUrl: url => url.startsWith('https://hylo-uploads.example.org/'),
        designTurn: async request => { received = request; return turn }
      })
      await run(admin.id, {
        images: [{ url: 'https://hylo-uploads.example.org/flyer.jpg' }, { url: 'https://elsewhere.example.com/pic.jpg' }],
        documents: [{ url: 'https://hylo-uploads.example.org/plan.pdf', name: 'plan.pdf' }]
      }, d)
      expect(received.images.map(image => image.visible)).to.deep.equal([true, false])
      expect(received.documents).to.deep.equal([{ url: 'https://hylo-uploads.example.org/plan.pdf', name: 'plan.pdf' }])

      await expect(run(admin.id, { documents: [{ url: 'https://elsewhere.example.com/plan.pdf' }] }, d)).to.be.rejectedWith(/uploaded to Hylo/)
      await expect(run(admin.id, { documents: [{ url: 'https://hylo-uploads.example.org/notes.docx' }] }, d)).to.be.rejectedWith(/Only PDF/)
    })

    it('tells the model about picked posts in the group and lets it use those and the summary\'s posts', async () => {
      const post = await factories.post({ user_id: admin.id, active: true, type: 'event', name: 'Seed swap', description: '<p>Bring seeds</p>', location: 'Rail Yard' }).save()
      await bookshelf.knex('groups_posts').insert({ group_id: group.id, post_id: post.id })
      const outside = await factories.post({ user_id: admin.id, active: true, type: 'event', name: 'Elsewhere' }).save()
      let received
      await run(admin.id, { postIds: [post.id, outside.id] }, deps({
        buildDigest: async () => ({ name: 'Garden', recentDays: 90, recentPosts: [{ id: '31', type: 'request', title: 'x', comments: 0, daysAgo: 1 }] }),
        designTurn: async request => { received = request; return turn }
      }))
      expect(received.pickedPostsSummary).to.contain(`- #${post.id} [event] Seed swap`)
      expect(received.pickedPostsSummary).to.contain('Where: Rail Yard')
      expect(received.pickedPostsSummary).to.contain('Details: Bring seeds')
      expect(received.pickedPostsSummary).to.not.contain('Elsewhere')
      expect(received.allowedPostIds).to.have.members(['31', String(post.id)])

      await expect(run(admin.id, { postIds: Array.from({ length: 7 }, (_, i) => i + 1) })).to.be.rejectedWith(/up to 6 posts/)
    })

    it('reports a failed design', async () => {
      await expect(run(admin.id, {}, deps({ designTurn: async () => { throw new Error('The design took too long') } })))
        .to.be.rejectedWith(/The design could not be made: The design took too long/)
    })
  })

  describe('buildGroupDigest', () => {
    it('summarises the group from titles and counts, leaving out chats, bodies and inactive posts', async () => {
      const other = await factories.group().save()
      const make = async (attrs, target = group) => {
        const post = await factories.post({ user_id: admin.id, active: true, ...attrs }).save()
        await bookshelf.knex('groups_posts').insert({ group_id: target.id, post_id: post.id })
        return post
      }
      const soon = new Date(Date.now() + 3 * 86400000)
      await make({ type: 'request', name: 'Spare <b>wheelbarrow</b>?', description: 'SECRET BODY', num_comments: 4 })
      await make({ type: 'offer', name: 'Tomato starts', fulfilled_at: new Date() })
      await make({ type: 'event', name: 'Compost workday', start_time: soon })
      await make({ type: 'chat', name: 'just chatting' })
      await make({ type: 'discussion', name: 'Deleted one', active: false })
      await make({ type: 'discussion', name: 'In another group' }, other)

      const digest = await buildGroupDigest(await Group.find(group.id))
      expect(digest.name).to.equal(group.get('name'))
      // Other tests in this file add event posts to the same group, so only the kinds made here are exact
      expect(digest.postCounts.request).to.equal(1)
      expect(digest.postCounts.offer).to.equal(1)
      expect(digest.postCounts.event).to.be.at.least(1)
      expect(digest.postCounts).to.not.have.property('chat')
      expect(digest.postCounts).to.not.have.property('discussion')
      expect(digest.openCounts).to.deep.equal({ request: 1 })
      expect(digest.upcomingEvents.map(event => event.title)).to.include('Compost workday')
      const titles = digest.recentPosts.map(post => post.title)
      expect(titles).to.include.members(['Spare wheelbarrow ?', 'Tomato starts', 'Compost workday'])
      expect(titles).to.not.include.members(['just chatting'])
      expect(titles).to.not.include.members(['Deleted one'])
      expect(titles).to.not.include.members(['In another group'])
      expect(JSON.stringify(digest)).to.not.contain('SECRET BODY')
      expect(digest.views.some(view => view.type === 'designed')).to.equal(true)

      // The summary carries the ids of the posts it names, and only those may be shown on a page
      const request = await Post.where({ name: 'Spare <b>wheelbarrow</b>?' }).fetch()
      expect(digestPostIds(digest)).to.include(String(request.id))
      const elsewhere = await Post.where({ name: 'In another group' }).fetch()
      const chat = await Post.where({ name: 'just chatting' }).fetch()
      expect(await postIdsInGroup(group.id, [request.id, elsewhere.id, chat.id, 'abc', '999999999'])).to.deep.equal([String(request.id)])

      const [picked] = await describePickedPosts(group.id, [elsewhere.id, request.id])
      expect(picked.id).to.equal(String(request.id))
      expect(picked.title).to.equal('Spare wheelbarrow ?')
      expect(picked.details).to.equal('SECRET BODY')
      expect(await describePickedPosts(group.id, [elsewhere.id])).to.deep.equal([])
    })
  })

  describe('suggestGroupViews', () => {
    const result = { reply: 'Requests are piling up.', suggestions: [{ name: 'Lend a Hand', why: 'x', prompt: 'y' }], usage: { inputTokens: 1 } }
    const deps = overrides => ({
      isConfigured: () => true,
      withinLimit: async () => true,
      buildDigest: async () => ({ name: 'Riverside Garden', memberCount: 86, recentDays: 90 }),
      suggestTurn: async () => result,
      ...overrides
    })

    it('sends the group summary to the model and returns its suggestions', async () => {
      let received
      const out = await suggestGroupViews({ userId: admin.id, groupId: group.id }, deps({ suggestTurn: async request => { received = request; return result } }))
      expect(out).to.deep.equal(result)
      expect(received.groupSummary).to.contain('Group name: Riverside Garden')
      expect(received.groupSummary).to.contain('Members: 86')
    })

    it('refuses members, groups without Pro and a reached limit, before any model call', async () => {
      let called = false
      const d = overrides => deps({ suggestTurn: async () => { called = true; return result }, ...overrides })
      await expect(suggestGroupViews({ userId: member.id, groupId: group.id }, d())).to.be.rejectedWith(/permission/)
      await expect(suggestGroupViews({ userId: admin.id, groupId: group.id }, d({ isConfigured: () => false }))).to.be.rejectedWith(/not set up/)
      await expect(suggestGroupViews({ userId: admin.id, groupId: group.id }, d({ withinLimit: async () => false }))).to.be.rejectedWith(/try again later/)
      await removePro()
      await expect(suggestGroupViews({ userId: admin.id, groupId: group.id }, d())).to.be.rejectedWith(/part of Hylo Pro/)
      expect(called).to.equal(false)
    })
  })
})
