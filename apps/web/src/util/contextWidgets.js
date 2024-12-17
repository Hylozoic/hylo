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

// TODO CONTEXT: need to check if a widget has a set icon, a default icon based on type/view/etc or can fall back on to the icon/avatar of its child
export function widgetIconResolver () {

}

export function isValidHomeWidget (widget) {
  if (widget?.viewUser?.id) return true
  if (widget?.viewPost?.id) return true
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
  if (parentWidget.viewGroup?.id) return false
  if (parentWidget.viewUser?.id) return false
  if (parentWidget.viewPost?.id) return false
  if (parentWidget.viewChat?.id) return false
  if (parentWidget.customView?.id) return false
  if (parentWidget.type === 'members') return false
  if (parentWidget.type === 'setup') return false
  if (parentWidget.type === 'chats' && !childWidget?.viewChat?.id) return false
  if (parentWidget.type === 'custom-views' && !childWidget?.customView?.id) return false
  if (childWidget?.type === 'home') return false
  if (childWidget?.id?.startsWith('fake-id')) return false
  if (childWidget?.id === parentWidget.id) return false
  return true
}

// TODO CONTEXT: add this to /shared
export function reorderTree ({ priorWidgetState = {}, newWidgetPosition, allWidgets }) {
  // Remove the old widget position
  const oldWidgetDetails = allWidgets.find(widget => widget.id === priorWidgetState?.id)
  // TODO CONTEXT: are oldWidgetDetails and priorWidgetState the same? Refractor this?
  let updatedWidgets = allWidgets.filter(widget => widget.id !== priorWidgetState?.id)
  let replacedWidget
  let oldPeers = []
  // Get the peers of the widget being moved
  if (priorWidgetState.order) {
    oldPeers = settle(getPeers(updatedWidgets, priorWidgetState))
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
  return { homeChild: widgets.find(widget => widget.parentId === homeParentId), homeParentId, }
}

// TODO CONTEXT: add this to /shared
export function replaceHomeWidget ({ widgets, newHomeWidgetId }) {
  const { homeChild, homeParentId } = findHomeChild(widgets)
  const priorWidgetState = widgets.find(widget => widget.id === newHomeWidgetId)
  let updatedWidgets = widgets.filter(widget => {
    if (widget.id === newHomeWidgetId) return false
    if (homeChild && widget.id === homeChild.id) return false
    return true
  })

  let oldPeers = []
  // Get the peers of the widget being moved, and settle them
  if (priorWidgetState.order) {
    oldPeers = settle(getPeers(updatedWidgets, priorWidgetState))
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
    ...priorWidgetState,
    order: 1,
    parentId: homeParentId
  })
  return updatedWidgets
}
