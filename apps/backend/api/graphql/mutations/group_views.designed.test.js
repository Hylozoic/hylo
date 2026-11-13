/* eslint-disable no-unused-expressions */
/* global GroupView, HyloProSubscription, bookshelf */
import factories from '../../../test/setup/factories'
import { createGroupView, updateGroupView, deleteGroupView, designGroupViewTurn } from './group_views'

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

    it('reports a failed design', async () => {
      await expect(run(admin.id, {}, deps({ designTurn: async () => { throw new Error('The design took too long') } })))
        .to.be.rejectedWith(/The design could not be made: The design took too long/)
    })
  })
})
