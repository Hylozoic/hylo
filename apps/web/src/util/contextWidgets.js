// These import/exports are included here just to have a central record of context widget utilities
export { widgetUrl } from './navigation'
export { default as useGatherItems } from 'hooks/useGatherItems'

export function widgetTitleResolver ({ widget, t }) {
  let title = widget.title
  if (title && title.startsWith('widget-')) {
    title = t(title)
  } else if (!title) {
    title = widget.viewGroup?.name || widget.viewUser?.name ||
            widget.viewPost?.title || widget.viewChat?.name ||
            widget.customView?.name || ''
  } else {
    title = title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  return title
}

export function isValidHomeWidget (widget) {
  if (widget?.viewChat?.id) return true
  if (widget?.customView?.id) return true
  if (widget?.view) return true

  return false
}

export function wrapItemInWidget (item, type) {
  return {
    [type]: item,
    id: 'fake-id-' + crypto.randomUUID()
  }
}

export function getStaticMenuWidgets ({ isPublic, isMyContext, profileUrl, isAllContext }) {
  let widgets = []

  if (isPublic) {
    widgets = [
      { context: 'public', title: 'widget-public-stream', id: 'widget-public-stream', view: 'stream', order: 1, parentId: null },
      { context: 'public', title: 'widget-public-groups', id: 'widget-public-groups', view: 'groups', order: 2, parentId: null },
      { context: 'public', title: 'widget-public-map', id: 'widget-public-map', view: 'map', type: 'map', order: 3, parentId: null },
      { context: 'public', title: 'widget-public-events', id: 'widget-public-events', view: 'events', order: 4, parentId: null }
    ]
  }

  if (isMyContext || isAllContext) {
    widgets = [
      { title: 'widget-my-groups-content', id: 'widget-my-groups-content', order: 2, parentId: null },
      { title: 'widget-my-groups-stream', id: 'widget-my-groups-stream', context: 'all', view: 'stream', order: 1, parentId: 'widget-my-groups-content' },
      { title: 'widget-my-groups-map', id: 'widget-my-groups-map', context: 'all', view: 'map', type: 'map', order: 2, parentId: 'widget-my-groups-content' },
      { title: 'widget-my-groups-events', id: 'widget-my-groups-events', context: 'all', view: 'events', order: 3, parentId: 'widget-my-groups-content' },
      // TODO CONTEXT: integrating the 'all' context into the 'my' context needs a lot of thought
      { title: 'widget-my-content', id: 'widget-my-content', order: 1, parentId: null },
      { icon: 'Posticon', title: 'widget-my-posts', id: 'widget-my-posts', view: 'posts', order: 1, parentId: 'widget-my-content', context: 'my' },
      { icon: 'Support', title: 'widget-my-interactions', id: 'widget-my-interactions', view: 'interactions', order: 2, parentId: 'widget-my-content', context: 'my' },
      { icon: 'Email', title: 'widget-my-mentions', id: 'widget-my-mentions', view: 'mentions', order: 3, parentId: 'widget-my-content', context: 'my' },
      { icon: 'Announcement', title: 'widget-my-announcements', id: 'widget-my-announcements', view: 'announcements', order: 4, parentId: 'widget-my-content', context: 'my' },
      { title: 'widget-myself', id: 'widget-myself', order: 3, parentId: null },
      { title: 'widget-my-profile', id: 'widget-my-profile', url: profileUrl, order: 1, parentId: 'widget-myself' },
      { title: 'widget-my-edit-profile', id: 'widget-my-edit-profile', context: 'my', view: 'edit-profile', order: 2, parentId: 'widget-myself' },
      { title: 'widget-my-groups', id: 'widget-my-groups', context: 'my', view: 'groups', order: 3, parentId: 'widget-myself' },
      { title: 'widget-my-invites', id: 'widget-my-invites', context: 'my', view: 'invitations', order: 4, parentId: 'widget-myself' },
      { title: 'widget-my-notifications', id: 'widget-my-notifications', context: 'my', view: 'notifications', order: 5, parentId: 'widget-myself' },
      { title: 'widget-my-locale', id: 'widget-my-locale', context: 'my', view: 'locale', order: 6, parentId: 'widget-myself' },
      { title: 'widget-my-account', id: 'widget-my-account', context: 'my', view: 'account', order: 7, parentId: 'widget-myself' },
      { title: 'widget-my-saved-searches', id: 'widget-my-saved-searches', context: 'my', view: 'saved-searches', order: 8, parentId: 'widget-myself' },
      { title: 'widget-my-logout', id: 'widget-my-logout', view: 'logout', type: 'logout', order: 4, parentId: null }
    ]
  }

  return widgets
}

export function findHomeView (group) {
  if (!group?.contextWidgets) {
    throw new Error('Group has no contextWidgets')
  }
  const homeWidget = group.contextWidgets.items.find(w => w.type === 'home')
  return group.contextWidgets.items.find(w => w.parentId === homeWidget.id)
}

export function widgetTypeResolver ({ widget }) {
  switch (true) {
    case !!widget.type:
      return widget.type
    case !!widget.view:
      return widget.view
    case !!widget.viewGroup:
      return 'viewGroup'
    case !!widget.viewPost:
      return 'viewPost'
    case !!widget.viewUser:
      return 'viewUser'
    case !!widget.viewChat:
      return 'viewChat'
    case !!widget.customView:
      return 'customView'
    default:
      return 'container'
  }
}

export function isWidgetDroppable ({ widget }) {
  if (widget.type === 'home') return false
  if (widget.id?.startsWith('fake-id')) return false
  return true
}

export function humanReadableTypes (type) {
  switch (true) {
    case type === 'group' || type === 'viewGroup':
      return 'group'
    case type === 'viewPost' || type === 'post':
      return 'post'
    case type === 'viewUser' || type === 'user':
      return 'member'
    case type === 'viewChat' || type === 'chat':
      return 'chat'
    case type === 'customView' || type === 'customview':
      return 'custom view'
    default:
      return 'container'
  }
}

// TODO CONTEXT: create tests for this
export function widgetIsValidChild ({ childWidget = {}, parentWidget }) {
  // TODO CONTEXT: stop container widgets from becoming children
  if (parentWidget?.viewGroup?.id) return false
  if (parentWidget?.viewUser?.id) return false
  if (parentWidget?.viewPost?.id) return false
  if (parentWidget?.viewChat?.id) return false
  if (parentWidget?.customView?.id) return false
  if (parentWidget?.type === 'members') return false
  if (parentWidget?.type === 'setup') return false
  if (parentWidget?.type === 'chats' && !childWidget?.viewChat?.id) return false
  if (parentWidget?.type === 'custom-views' && !childWidget?.customView?.id) return false
  if (childWidget?.type === 'home') return false
  if (childWidget?.id?.startsWith('fake-id')) return false
  if (childWidget?.id === parentWidget?.id) return false
  return true
}

export function reorderTree ({ widgetToBeMovedId, newWidgetPosition, allWidgets }) {
  // Remove the old widget position
  const oldWidgetDetails = allWidgets.find(widget => widget.id === widgetToBeMovedId)

  let updatedWidgets = allWidgets.filter(widget => widget.id !== widgetToBeMovedId)
  let replacedWidget
  let oldPeers = []
  // Get the peers of the widget being moved
  if (oldWidgetDetails.order) {
    oldPeers = settle(getPeers(updatedWidgets, oldWidgetDetails))
  }
  updatedWidgets = updatedWidgets.map(widget => {
    const settledPeer = oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })

  if (newWidgetPosition.remove) {
    updatedWidgets.push({ ...oldWidgetDetails, order: null, parentId: null })
    return updatedWidgets
  }

  if (newWidgetPosition.orderInFrontOfWidgetId) {
    replacedWidget = updatedWidgets.find(widget => widget.id === newWidgetPosition.orderInFrontOfWidgetId)
  }

  let newPeers = replacedWidget ? getPeers(updatedWidgets, replacedWidget) : getPeers(updatedWidgets, newWidgetPosition)
  if (!replacedWidget) {
    const newOrder = newPeers.length > 0 ? newPeers.sort((a, b) => a.order - b.order)[newPeers.length - 1].order : 0
    newPeers.push({ ...oldWidgetDetails, id: newWidgetPosition.id, order: newOrder + 1, parentId: newWidgetPosition.parentId || null })
  } else {
    newPeers = newPeers.reduce((acc, widget) => {
      if (widget.order > replacedWidget.order) {
        acc.push({ ...widget, order: widget.order + 1 })
      } else if (widget.order === replacedWidget.order) {
        acc.push({ ...widget, order: widget.order + 1 })
        acc.push({ ...oldWidgetDetails, id: newWidgetPosition.id, order: widget.order, parentId: widget.parentId || null })
      } else {
        acc.push(widget)
      }
      return acc
    }, [])
  }

  return allWidgets.map(widget => {
    const settledPeer = newPeers.find(peer => peer.id === widget.id) || oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })
}
// TODO CONTEXT: add this to /shared
function getPeers (widgets, widget) {
  if (widget.parentId) return widgets.filter(w => w.parentId === widget.parentId)
  return widgets.filter(w => !w.parentId && !!w.order)
}
// TODO CONTEXT: add this to /shared
function settle (items) {
  return items.sort((a, b) => a.order - b.order).map((item, index) => ({
    ...item,
    order: item.order !== index + 1 ? item.order - 1 : item.order
  }))
}
// TODO CONTEXT: add this to /shared
function findHomeChild (widgets) {
  const homeParentId = widgets.find(widget => widget.type === 'home')?.id
  return { homeChild: widgets.find(widget => widget.parentId === homeParentId), homeParentId }
}

// TODO CONTEXT: add this to /shared
export function replaceHomeWidget ({ widgets, newHomeWidgetId }) {
  const { homeChild, homeParentId } = findHomeChild(widgets)
  const widgetToBeMoved = widgets.find(widget => widget.id === newHomeWidgetId)
  let updatedWidgets = widgets.filter(widget => {
    if (widget.id === newHomeWidgetId) return false
    if (homeChild && widget.id === homeChild.id) return false
    return true
  })

  let oldPeers = []
  // Get the peers of the widget being moved, and settle them
  if (widgetToBeMoved.order) {
    oldPeers = settle(getPeers(updatedWidgets, widgetToBeMoved))
  }

  updatedWidgets = updatedWidgets.map(widget => {
    const settledPeer = oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })

  // so by here the updatedWidgets array has removed the new home widget from its prior position and its prior peers are settled

  // if the old home widget is a chat, we need to move it to the top of the chats widget, otherwise we remove it from the menu
  if (homeChild.type === 'chat') {
    const chatsWidgetId = updatedWidgets.find(widget => widget.type === 'chats')?.id
    const newPeers = updatedWidgets.filter(widget => widget.parentId === chatsWidgetId).map(peer => ({
      ...peer,
      order: peer.order + 1
    }))

    updatedWidgets.push({
      ...homeChild,
      parentId: chatsWidgetId,
      order: 1
    })
    updatedWidgets = updatedWidgets.map(widget => newPeers.find(peer => peer.id === widget.id) || widget)
  } else {
    updatedWidgets.push({
      ...homeChild,
      order: null,
      parentId: null
    })
  }

  updatedWidgets.push({
    ...widgetToBeMoved,
    order: 1,
    parentId: homeParentId
  })
  return updatedWidgets
}
