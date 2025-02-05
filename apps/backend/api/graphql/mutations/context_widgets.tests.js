const { expect } = require('chai')
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
const { 
  createContextWidget, 
  updateContextWidget, 
  reorderContextWidget, 
  removeWidgetFromMenu,
  transitionGroupToNewMenu
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

describe('mutations/context_widgets/transitionGroupToNewMenu', () => {
  let user, group, nonAdminUser, tag, customView, location, tag2

  before(async () => {
    // Create base entities
    user = await factories.user().save()
    nonAdminUser = await factories.user().save()
    group = await factories.group().save()
    location = await factories.location().save()

    // Add user as admin
    await user.joinGroup(group, { role: GroupMembership.Role.MODERATOR })
    await nonAdminUser.joinGroup(group)

    // Create content
    const project = await factories.post().save({
      type: 'project',
      name: 'Test Project',
      user_id: user.id
    })
    await project.groups().attach(group.id)

    const proposal = await factories.post().save({
      type: 'proposal',
      name: 'Test Proposal',
      user_id: user.id
    })
    await proposal.groups().attach(group.id)

    const event = await factories.post().save({
      type: 'event',
      name: 'Test Event',
      user_id: user.id
    })
    await event.groups().attach(group.id)

    const request = await factories.post().save({
      type: 'request',
      name: 'Test Request',
      location_id: location.id,
      user_id: user.id
    })
    await request.groups().attach(group.id)

    // Create child group relationship
    const childGroup = await factories.group().save()
    await GroupRelationship.forge({
      parent_group_id: group.id,
      child_group_id: childGroup.id,
      active: true
    }).save()

    // Create custom view
    customView = await factories.customView().save({
      group_id: group.id,
      order: 1
    })

    // Create tag and group tag, and chat post with tag
    tag = await factories.tag().save({ name: 'test' })
    tag2 = await factories.tag().save({ name: 'not-pinned' })

    await Tag.addToGroup({
      group_id: group.id,
      tag_id: tag.id,
      user_id: user.id,
      visibility: 2
    })

    await Tag.addToGroup({
      group_id: group.id,
      tag_id: tag2.id,
      user_id: user.id,
      visibility: 1
    })

    // First chat post
    const chatPost = await factories.post().save({
      type: 'chat',
      user_id: user.id
    })
    await chatPost.groups().attach(group.id)

    await factories.postTag().save({
      post_id: chatPost.id,
      tag_id: tag.id
    })

    // Second chat post
    const chatPost2 = await factories.post().save({
      type: 'chat',
      user_id: user.id
    })
    await chatPost2.groups().attach(group.id)

    await factories.postTag().save({
      post_id: chatPost2.id,
      tag_id: tag2.id
    })
  })

  after(() => setup.clearDb())

  it('transitions a group with content to the new menu system', async () => {
    await transitionGroupToNewMenu({ userId: user.id, groupId: group.id })
    const widgets = await ContextWidget.where({ group_id: group.id }).fetchAll()
    
    // Check chat widget
    it('creates a chat widget for a pinned tag', () => {
      const chatWidget = widgets.find(w => w.get('type') === 'chat' && w.get('view_chat_id') === tag.id)
      expect(chatWidget).to.exist
      expect(chatWidget.get('order')).to.not.be.null
    })

    it('creates a chat widget for a regular tag', () => {
      const chatWidget = widgets.find(w => w.get('type') === 'chat' && w.get('view_chat_id') === tag2.id)
      expect(chatWidget).to.exist
      expect(chatWidget.get('order')).to.be.null
    })

    it('reorders the chats widget, since it now has a child', () => {
      const chatsWidget = widgets.find(w => w.get('view') === 'chats')
      expect(chatsWidget.get('order')).to.equal(2)
    })

    const autoAddWidget = widgets.find(w => w.get('type') === 'auto-view')
    const autoAddWidgetId = autoAddWidget.get('id')

    it('Adds the ask and offer widget to the auto-view widget', () => {
      const askOfferWidget = widgets.find(w => w.get('view') === 'ask-and-offer')
      expect(askOfferWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(askOfferWidget.get('order')).to.not.be.null
    })

    it('Adds the events widget to the auto-view widget', () => {
      const eventsWidget = widgets.find(w => w.get('type') === 'events')
      expect(eventsWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(eventsWidget.get('order')).to.not.be.null
    })

    it('Adds the projects widget to the auto-view widget', () => {
      const projectsWidget = widgets.find(w => w.get('type') === 'projects')
      expect(projectsWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(projectsWidget.get('order')).to.not.be.null
    })

    it('Adds the groups widget to the auto-view widget', () => {
      const groupsWidget = widgets.find(w => w.get('type') === 'groups')
      expect(groupsWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(groupsWidget.get('order')).to.not.be.null
    })

    it('Adds the decisions widget to the auto-view widget', () => {
      const decisionsWidget = widgets.find(w => w.get('type') === 'decisions')
      expect(decisionsWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(decisionsWidget.get('order')).to.not.be.null
    })

    it('Adds the map widget to the auto-view widget', () => {
      const mapWidget = widgets.find(w => w.get('type') === 'map')
      expect(mapWidget.get('parent_id')).to.equal(autoAddWidgetId)
      expect(mapWidget.get('order')).to.not.be.null
    })
    
    // Check custom views
    it('Creates a custom view widget and add it to the custom views widget', () => {
      const customViewsWidget = widgets.find(w => w.get('type') === 'custom-views')
      const customViewWidget = widgets.find(w => String(w.get('custom_view_id')) === String(customView.id))

      expect(customViewWidget).to.exist
      expect(customViewWidget.get('parent_id')).to.equal(customViewsWidget.get('id'))
    })
  })

  it('prevents non-admin users from transitioning the menu', async () => {
    await expect(
      transitionGroupToNewMenu({ userId: nonAdminUser.id, groupId: group.id })
    ).to.be.rejectedWith("You don't have permission to modify this group's menu")
  })
})