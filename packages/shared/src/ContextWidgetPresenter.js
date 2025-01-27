
export default function ContextWidgetPresenter (widget, { t }) {
  if (!widget) return widget

  return {
    ...widget,
    type: widgetTypeInferrer({ widget }),
    title: widgetTitleResolver({ widget, t })
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

// TODO redesign: This has mainly been a dev helper, need to decide how we present things in the ALL VIEW
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