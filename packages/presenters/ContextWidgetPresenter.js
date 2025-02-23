export default function ContextWidgetPresenter (widget) {
  if (!widget || widget?._presented) return widget

  // Resolve type once and pass it explicitly
  const type = widgetTypeResolver({ widget })
  const avatarData = avatarDataResolver(widget)

  return {
    ...widget,
    avatarUrl: avatarData?.avatarUrl,
    displayName: avatarData?.displayName,
    humanReadableType: humanReadableTypeResolver(type),
    iconName: iconNameResolver(widget, type),
    isDroppable: isDroppableResolver(widget),
    isValidHomeWidget: isValidHomeWidgetResolver(widget),
    title: titleResolver(widget),
    type,
    // Protection from double presenting
    _presented: true
  }
}

/* == Attribute Resolvers == */

function titleResolver (widget) {
  let title = widget?.title
  if (title.startsWith('widget-')) return title
  if (!title) {
    title =
      widget?.viewGroup?.name ||
      widget?.viewUser?.name ||
      widget?.viewPost?.title ||
      widget?.viewChat?.name ||
      widget?.customView?.name ||
      ''
  } else {
    title = title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return title
}

function isValidHomeWidgetResolver (widget) {
  return !!(
    widget?.viewChat?.id ||
    widget?.customView?.id ||
    widget?.view
  )
}

function avatarDataResolver (widget) {
  if (widget?.viewUser) {
    return { avatarUrl: widget.viewUser?.avatarUrl, displayName: widget.viewUser?.name }
  }
  if (widget?.viewGroup) {
    return { avatarUrl: widget.viewGroup?.avatarUrl, displayName: widget.viewGroup?.name }
  }
  return null // Ensures avatarUrl & displayName exist but remain null if not applicable
}

// Determines the correct icon name for a given widget type
const WIDGET_TYPE_TO_ICON_NAME_MAP = {
  setup: 'Settings',
  'custom-views': 'Stack',
  chats: 'Message',
  viewChat: 'Message',
  chat: 'Message',
  viewPost: 'Posticon',
  about: 'Info',
  'all-views': 'Grid3x3'
}
function iconNameResolver (widget, type) {
  if (widget?.iconName) return widget.iconName
  if (widget?.customView?.icon) return widget.customView.icon
  if (widget?.context === 'my') return null

  return WIDGET_TYPE_TO_ICON_NAME_MAP[type] || COMMON_VIEWS[type]?.iconName || null
}

// Determines whether a widget can be dropped into another container
function isDroppableResolver (widget) {
  if (widget?.type === 'home') return false
  if (widget?.id?.startsWith('fake-id')) return false
  return true
}

// This internal resolver is exported to create mutation data prep in Web AllView#AddViewDialog
// consider adding a makeCreateVariables method added to this presenter module
export function humanReadableTypeResolver (type) {
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

function widgetTypeResolver ({ widget }) {
  return (
    widget?.type ||
    widget?.view ||
    (widget?.viewGroup && 'viewGroup') ||
    (widget?.viewPost && 'viewPost') ||
    (widget?.viewUser && 'viewUser') ||
    (widget?.viewChat && 'viewChat') ||
    (widget?.customView && 'customView') ||
    'container'
  )
}

export const isHiddenInContextMenuResolver = (widget) => {
  /*
    One of the AND rules for hiding a widget for the context menu
    (something needs to fail a set of the rules to be hidden),
    is not having any children. Since widgets arrive from the server in a flat array,
    the needs-to-be-hidden quality of a widget has to wait until things are ordered for this to be accurate.
  */
  return (!['members', 'setup'].includes(widget.type) && !widget.view && widget?.childWidgets?.length === 0 &&
  !widget.viewGroup && !widget.viewUser && !widget.viewPost &&
  !widget.viewChat && !widget.customView)
}

/* == ContextWidget collection methods, Static Views, and utility functions == */

// TODO: To be relocated to GroupPresenter once utilized in Web
export function findHomeWidget (group) {
  if (!group?.contextWidgets) {
    throw new Error('Group has no contextWidgets')
  }
  const homeWidget = group.contextWidgets.items.find(w => w.type === 'home')
  return group.contextWidgets.items.find(w => w.parentId === homeWidget.id)
}

export function getStaticMenuWidgets ({ isPublicContext, isMyContext, profileUrl }) {
  if (isPublicContext) return PUBLIC_CONTEXT_WIDGETS
  if (isMyContext) return MY_CONTEXT_WIDGETS(profileUrl)
}

// Determines if a child widget is valid inside a parent widget
export function isValidChildWidget ({ childWidget = {}, parentWidget }) {
  return !(
    parentWidget?.viewGroup?.id ||
    parentWidget?.viewUser?.id ||
    parentWidget?.customView?.id ||
    parentWidget?.type === 'members' ||
    parentWidget?.type === 'setup' ||
    (parentWidget?.type === 'chats' && !childWidget?.viewChat?.id) ||
    (parentWidget?.type === 'custom-views' && !childWidget?.customView?.id) ||
    childWidget?.type === 'home' ||
    childWidget?.id?.startsWith('fake-id') ||
    childWidget?.id === parentWidget?.id ||
    childWidget?.type === 'container'
  )
}

export const orderContextWidgetsForContextMenu = (contextWidgets) => {
  // Step 1: Filter out widgets without an order, as these are not displayed in the context menu
  const orderedWidgets = contextWidgets.filter(widget => widget.order !== null)

  // Step 2: Split into parentWidgets and childWidgets
  const parentWidgets = orderedWidgets.filter(widget => !widget?.parentId)
  const childWidgets = orderedWidgets.filter(widget => widget?.parentId)

  // Step 3: Add an empty array for childWidgets to each parentWidget
  parentWidgets.forEach(parent => {
    parent.childWidgets = []
  })

  // Step 4: Append each childWidget to the appropriate parentWidget
  childWidgets.forEach(child => {
    const parent = parentWidgets.find(parent => parent.id === child?.parentId)
    if (parent) {
      parent.childWidgets.push(child)
    }
  })

  // Step 5: Sort parentWidgets and each childWidgets array by order
  parentWidgets.sort((a, b) => a.order - b.order)
  parentWidgets.forEach(parent => {
    parent.childWidgets.sort((a, b) => a.order - b.order)
  })

  // Return the sorted parentWidgets with nested childWidgets
  return parentWidgets
}

export function translateTitle (title, t) {
  return title && title.startsWith('widget-') ? t(title) : title
}

export function wrapItemInWidget (item, type) {
  return {
    [type]: item,
    id: 'fake-id-' + crypto.randomUUID()
  }
}

// Static widgets and widget data
const TERMS_AND_CONDITIONS_URL = 'https://hylo-landing.surge.sh/terms'

const PUBLIC_CONTEXT_WIDGETS = [
  { context: 'public', view: 'stream', title: 'widget-public-stream', id: 'widget-public-stream', order: 1, parentId: null },
  { context: 'public', view: 'groups', title: 'widget-public-groups', id: 'widget-public-groups', order: 2, parentId: null },
  { context: 'public', view: 'map', title: 'widget-public-map', id: 'widget-public-map', type: 'map', order: 3, parentId: null },
  { context: 'public', view: 'events', title: 'widget-public-events', id: 'widget-public-events', order: 4, parentId: null }
]

const MY_CONTEXT_WIDGETS = (profileUrl) => [
  { title: 'widget-my-groups-content', id: 'widget-my-groups-content', order: 2, parentId: null },
  { context: 'all', view: 'stream', title: 'widget-my-groups-stream', id: 'widget-my-groups-stream', order: 1, parentId: 'widget-my-groups-content' },
  { context: 'all', view: 'map', title: 'widget-my-groups-map', id: 'widget-my-groups-map', type: 'map', order: 2, parentId: 'widget-my-groups-content' },
  { context: 'all', view: 'events', title: 'widget-my-groups-events', id: 'widget-my-groups-events', order: 3, parentId: 'widget-my-groups-content' },
  { title: 'widget-my-content', id: 'widget-my-content', order: 1, parentId: null },
  { context: 'my', view: 'posts', iconName: 'Posticon', title: 'widget-my-posts', id: 'widget-my-posts', order: 1, parentId: 'widget-my-content' },
  { context: 'my', view: 'interactions', iconName: 'Support', title: 'widget-my-interactions', id: 'widget-my-interactions', order: 2, parentId: 'widget-my-content' },
  { context: 'my', view: 'mentions', iconName: 'Email', title: 'widget-my-mentions', id: 'widget-my-mentions', order: 3, parentId: 'widget-my-content' },
  { context: 'my', view: 'announcements', iconName: 'Announcement', title: 'widget-my-announcements', id: 'widget-my-announcements', order: 4, parentId: 'widget-my-content' },
  { title: 'widget-myself', id: 'widget-myself', order: 3, parentId: null },
  { title: 'widget-my-profile', id: 'widget-my-profile', url: profileUrl, order: 1, parentId: 'widget-myself' },
  { context: 'my', view: 'edit-profile', title: 'widget-my-edit-profile', id: 'widget-my-edit-profile', order: 2, parentId: 'widget-myself' },
  { context: 'my', view: 'groups', title: 'widget-my-groups', id: 'widget-my-groups', order: 3, parentId: 'widget-myself' },
  { context: 'my', view: 'invitations', title: 'widget-my-invites', id: 'widget-my-invites', order: 4, parentId: 'widget-myself' },
  { context: 'my', view: 'notifications', title: 'widget-my-notifications', id: 'widget-my-notifications', order: 5, parentId: 'widget-myself' },
  { context: 'my', view: 'locale', title: 'widget-my-locale', id: 'widget-my-locale', order: 6, parentId: 'widget-myself' },
  { context: 'my', view: 'account', title: 'widget-my-account', id: 'widget-my-account', order: 7, parentId: 'widget-myself' },
  { context: 'my', view: 'saved-searches', title: 'widget-my-saved-searches', id: 'widget-my-saved-searches', order: 8, parentId: 'widget-myself' },
  { context: 'my', url: TERMS_AND_CONDITIONS_URL, title: 'widget-terms-and-conditions', id: 'widget-terms-and-conditions', order: 9, parentId: 'widget-myself' },
  { view: 'logout', title: 'widget-my-logout', id: 'widget-my-logout', type: 'logout', order: 4, parentId: null }
]

export const COMMON_VIEWS = {
  proposals: {
    name: 'Proposals',
    iconName: 'Proposal',
    defaultViewMode: 'cards',
    postTypes: ['proposal'],
    defaultSortBy: 'created'
  },
  discussions: {
    name: 'Discussions',
    iconName: 'Message',
    defaultViewMode: 'list',
    postTypes: ['discussion'],
    defaultSortBy: 'updated'
  },
  events: {
    name: 'Events',
    iconName: 'Calendar',
    defaultViewMode: 'cards',
    postTypes: ['event'],
    defaultSortBy: 'start_time'
  },
  groups: {
    name: 'Groups',
    iconName: 'Groups'
  },
  map: {
    name: 'Map',
    iconName: 'Globe'
  },
  members: {
    name: 'Members',
    iconName: 'People'
  },
  moderation: {
    name: 'Moderation',
    iconName: 'Shield'
  },
  projects: {
    name: 'Projects',
    iconName: 'Stack',
    defaultViewMode: 'bigGrid',
    postTypes: ['project'],
    defaultSortBy: 'created'
  },
  'requests-and-offers': {
    name: 'Requests & Offers',
    iconName: 'Request',
    defaultViewMode: 'bigGrid',
    postTypes: ['request', 'offer'],
    defaultSortBy: 'created'
  },
  resources: {
    name: 'Resources',
    iconName: 'Document',
    defaultViewMode: 'grid',
    postTypes: ['resource'],
    defaultSortBy: 'created'
  },
  stream: {
    name: 'Stream',
    iconName: 'Stream',
    defaultViewMode: 'cards',
    defaultSortBy: 'created'
  }
}
