const { expect } = require('chai')
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
const {
  createContextWidget,
  updateContextWidget,
  reorderContextWidget,
  removeWidgetFromMenu,
} = require('./context_widgets')

describe('mutations/context_widgets', () => {
  let user, group, post, chat, nonAdminUser

  before(async () => {
    // Create test entities
    user = await factories.user().save()
    nonAdminUser = await factories.user().save()
    group = await factories.group().save()
    post = await factories.post().save()
    chat = await factories.tag().save({ name: 'test-chat' })

    // Add user as admin to group
    await user.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    // Add non-admin user as regular member
    await nonAdminUser.joinGroup(group)

    // Setup initial context widgets
    await group.setupContextWidgets()
  })

  after(() => setup.clearDb())

  describe('initial context widget setup', () => {
    it('creates the correct initial widgets in the correct order', async () => {
      const widgets = await ContextWidget.findForGroup(group.id)
      const orderedWidgets = widgets.filter(w => w.get('order') !== null)

      // Check ordered widgets
      expect(orderedWidgets.length).to.equal(7)

      const homeWidget = orderedWidgets.find(w => w.get('type') === 'home')
      const autoViewWidget = orderedWidgets.find(w => w.get('type') === 'auto-view')
      const membersWidget = orderedWidgets.find(w => w.get('type') === 'members')
      const setupWidget = orderedWidgets.find(w => w.get('type') === 'setup')
      const customViewsWidget = orderedWidgets.find(w => w.get('type') === 'custom-views')

      expect(homeWidget.get('order')).to.equal(1)
      expect(autoViewWidget.get('order')).to.equal(3)
      expect(membersWidget.get('order')).to.equal(4)
      expect(setupWidget.get('order')).to.equal(5)
      expect(customViewsWidget.get('order')).to.equal(6)

      // Check unordered widgets exist
      const unorderedWidgets = widgets.filter(w => w.get('order') === null)

      expect(unorderedWidgets.length).to.equal(9) // discussions, stream, events, etc.
    })

    it('creates the hearth widget as a child of home', async () => {
      const homeWidget = await ContextWidget.where({ type: 'home', group_id: group.id }).fetch()
      const children = homeWidget.related('children')

      expect(children.length).to.equal(1)
      expect(children.first().get('type')).to.equal('chat')
      expect(children.first().get('order')).to.equal(1)
    })
  })

  describe('reorderContextWidget', () => {
    it('prevents reordering widgets to position 1 (home widget position)', async () => {
      const setupWidget = await ContextWidget.where({ type: 'setup' }).fetch()

      await expect(
        reorderContextWidget({
          userId: user.id,
          contextWidgetId: setupWidget.id,
          order: 1
        })
      ).to.be.rejectedWith('The home widget must remain the first widget in the context menu')
    })

    it('correctly reorders widgets and updates peer orders', async () => {
      const setupWidget = await ContextWidget.where({ type: 'setup', group_id: group.id }).fetch()

      await reorderContextWidget({
        userId: user.id,
        contextWidgetId: setupWidget.id,
        order: 2
      })

      const widgets = await ContextWidget.findForGroup(group.id)
      const orderedWidgets = widgets.filter(w => w.get('order') !== null)

      const autoViewWidget = orderedWidgets.find(w => w.get('type') === 'auto-view')
      const membersWidget = orderedWidgets.find(w => w.get('type') === 'members')
      const setupWidget2 = orderedWidgets.find(w => w.get('type') === 'setup')

      expect(setupWidget2.get('order')).to.equal(2)
      expect(autoViewWidget.get('order')).to.equal(4)
      expect(membersWidget.get('order')).to.equal(5)
    })

    it('orders an unordered widget as a child of another widget', async () => {
      const autoViewWidget = await ContextWidget.where({ type: 'auto-view', group_id: group.id }).fetch()
      const eventsWidget = await ContextWidget.where({ type: 'events', group_id: group.id }).fetch()

      await updateContextWidget({
        userId: user.id,
        contextWidgetId: eventsWidget.id,
        data: { parent_id: autoViewWidget.id }
      })

      await eventsWidget.refresh()
      expect(eventsWidget.get('parent_id')).to.equal(autoViewWidget.id)
      expect(eventsWidget.get('order')).to.equal(1)
    })

    it('assigns last order position when no order specified', async () => {
      const mapWidget = await ContextWidget.where({ type: 'map', group_id: group.id }).fetch()

      await reorderContextWidget({
        userId: user.id,
        contextWidgetId: mapWidget.id,
      })

      await mapWidget.refresh()
      expect(mapWidget.get('order')).to.equal(7)
    })

    it('removes a widget from the menu and reorders peers', async () => {
      const setupWidget = await ContextWidget.where({ type: 'setup', group_id: group.id }).fetch()

      await removeWidgetFromMenu({
        userId: user.id,
        contextWidgetId: setupWidget.id
      })

      await setupWidget.refresh()
      expect(setupWidget.get('order')).to.be.null

      const widgets = await ContextWidget.findForGroup(group.id)
      const orderedWidgets = widgets.filter(w => w.get('order') !== null)

      const autoViewWidget = orderedWidgets.find(w => w.get('type') === 'auto-view')
      const membersWidget = orderedWidgets.find(w => w.get('type') === 'members')
      const customViewsWidget = orderedWidgets.find(w => w.get('type') === 'custom-views')
      const mapWidget = orderedWidgets.find(w => w.get('type') === 'map')

      expect(autoViewWidget.get('order')).to.equal(3)
      expect(membersWidget.get('order')).to.equal(4)
      expect(customViewsWidget.get('order')).to.equal(5)
      expect(mapWidget.get('order')).to.equal(6)
    })
  })

  describe('permissions', () => {
    it('prevents non-admin users from creating widgets', async () => {
      await expect(
        createContextWidget({
          userId: nonAdminUser.id,
          groupId: group.id,
          data: { title: 'test widget' }
        })
      ).to.be.rejectedWith("You don't have permission to create context widgets for this group")
    })

    it('prevents non-admin users from updating widgets', async () => {
      const widget = await ContextWidget.where({ type: 'setup' }).fetch()

      await expect(
        updateContextWidget({
          userId: nonAdminUser.id,
          contextWidgetId: widget.id,
          data: { title: 'new title' }
        })
      ).to.be.rejectedWith("You don't have permission to update context widgets for this group")
    })
  })

  describe('view references', () => {
    it('prevents setting multiple view references', async () => {
      await expect(
        createContextWidget({
          userId: user.id,
          groupId: group.id,
          data: {
            title: 'test widget',
            view_post_id: post.id,
            view_chat_id: chat.id
          }
        })
      ).to.be.rejectedWith('Only one view reference can be set')
    })

    it('allows updating between different view references', async () => {
      const widget = await createContextWidget({
        userId: user.id,
        groupId: group.id,
        data: {
          title: 'test widget',
          view_post_id: post.id,
          type: 'test'
        }
      })

      const updated = await updateContextWidget({
        userId: user.id,
        contextWidgetId: widget.id,
        data: {
          viewChatId: chat.id
        }
      })

      expect(updated.get('view_post_id')).to.be.null
      expect(updated.get('view_chat_id')).to.equal(chat.id)
    })
  })
})
