export default function ContextWidgetPresenter (widget, { t }) {
  if (!widget) return widget

  return {
    ...widget,
    type: widgetTypeInferrer({ widget }),
    title: widgetTitleResolver({ widget, t }),
    isDroppable: isWidgetDroppable({ widget }),
    humanReadableType: humanReadableTypes(widgetTypeInferrer({ widget })),
    isValidHomeWidget: isValidHomeWidget(widget)
  }
}

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

export function isWidgetDroppable ({ widget }) {
  if (widget.type === 'home') return false
  if (widget.id?.startsWith('fake-id')) return false
  return true
}

export function findHomeView (group) {
  if (!group?.contextWidgets) {
    throw new Error('Group has no contextWidgets')
  }
  const homeWidget = group.contextWidgets.items.find(w => w.type === 'home')
  return group.contextWidgets.items.find(w => w.parentId === homeWidget.id)
}

export function widgetTypeInferrer ({ widget }) {
  return widget?.type
    || widget?.view
    || widget?.viewGroup && 'viewGroup'
    || widget?.viewPost && 'viewPost'
    || widget?.viewUser && 'viewUser'
    || widget?.viewChat && 'viewChat'
    || widget?.customView && 'customView'
    || 'container'
}

// TODO redesign: This has mainly been a dev helper, need to decide how we present things in the ALL VIEW
export function humanReadableTypes (type) {
  switch (true) {
    case type === 'home':
      return 'home'
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
    case type === null:
      return 'container'
    default:
      return type
  }
}

export function widgetIsValidChild ({ childWidget = {}, parentWidget }) {
  // TODO redesign: create tests for this
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
  if (childWidget?.type === 'container') return false
  return true
}
