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
    isEditable: isEditableResolver(widget),
    isDeletable: isDeleteableResolver(widget),
    isValidHomeWidget: isValidHomeWidgetResolver(widget),
    title: titleResolver(widget),
    type,
    // Protection from double presenting
    _presented: true
  }
}

/* Constants */

export const types = {
  CHAT: 'viewChat',
  CONTAINER: 'container',
  CUSTOM_VIEW: 'customView',
  FUNDING_ROUND: 'viewFundingRound',
  GROUP: 'viewGroup',
  POST: 'viewPost',
  TRACK: 'viewTrack',
  USER: 'viewUser'
}

/* == Attribute Resolvers == */

function titleResolver (widget) {
  let title = widget?.title
  if (title && title.startsWith('widget-')) return title
  if (!title) {
    title =
      widget?.viewGroup?.name ||
      widget?.viewUser?.name ||
      widget?.viewPost?.title ||
      widget?.viewChat?.name ||
      widget?.customView?.name ||
      widget?.viewTrack?.name ||
      widget?.viewFundingRound?.title ||
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
    widget?.viewTrack?.id ||
    widget?.viewFundingRound?.id ||
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
  about: 'Info',
  setup: 'Settings',
  'custom-views': 'Stack',
  chats: 'Topics',
  viewChat: 'Topics',
  viewFundingRound: 'BadgeDollarSign',
  viewPost: 'Posticon',
  viewTrack: 'Shapes'
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

// Only some widgets can have their titles and visibility edited
function isEditableResolver (widget) {
  const type = widgetTypeResolver({ widget })
  return type === 'customView' ||
    type === 'container'
}

// Only custom created widgets can be fully deleted
function isDeleteableResolver (widget) {
  const type = widgetTypeResolver({ widget })
  return ['container', 'viewGroup', 'viewPost', 'viewChat', 'customView', 'viewUser', 'viewChat', 'viewTrack', 'viewFundingRound'].includes(type)
}

// This internal resolver is exported to create mutation data prep in Web AllView#AddViewDialog
// consider adding a makeCreateVariables method added to this presenter module
export function humanReadableTypeResolver (type) {
  switch (true) {
    case type === 'home':
      return 'home'
    case type === 'viewGroup':
      return 'group'
    case type === 'viewPost':
      return 'post'
    case type === 'viewUser':
      return 'member'
    case type === 'viewChat':
      return 'chat'
    case type === 'customView':
      return 'custom view'
    case type === 'viewTrack':
      return 'track'
    case type === 'viewFundingRound':
      return 'funding round'
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
    (widget?.viewTrack && 'viewTrack') ||
    (widget?.viewFundingRound && 'viewFundingRound') ||
    (widget?.customView && 'customView') ||
    (widget?.url && 'link') ||
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
  !widget.viewGroup && !widget.viewUser && !widget.viewPost && !widget.viewTrack && !widget.viewFundingRound &&
  !widget.viewChat && !widget.customView) ||
  // Hide unpublished tracks
  (widget.type === 'viewTrack' && widget.viewTrack?.publishedAt === null) ||
  (widget.type === 'viewFundingRound' && widget.viewFundingRound?.publishedAt === null)
}

/* == ContextWidget collection methods, Static Views, and utility functions == */

export function getStaticMenuWidgets ({ isPublicContext, isMyContext, profileUrl }) {
  if (isPublicContext) return PUBLIC_CONTEXT_WIDGETS
  if (isMyContext) return MY_CONTEXT_WIDGETS(profileUrl)
}

// Determines if a child widget is valid inside the parent widget
export function isValidChildWidget ({ parentWidget, childWidget }) {
  const isWrongType = ['home', 'members', 'setup'].includes(parentWidget?.type)
    || (parentWidget?.type === 'chats' && !childWidget?.viewChat?.name)
    || (parentWidget?.type === 'custom-views' && !childWidget?.customView?.id)
  const parentWidgetIsContainer = parentWidget?.childWidgets?.length > 0
    || ['container', 'custom-views', 'chats', 'members', 'setup', 'auto-view'].includes(parentWidget?.type)
  const childWidgetIsContainer = childWidget?.childWidgets?.length > 0
    || ['container', 'custom-views', 'chats', 'members', 'setup', 'auto-view'].includes(childWidget?.type)

  return !(
    isWrongType
      || parentWidget?.viewGroup?.slug
      || parentWidget?.viewChat?.name
      || parentWidget?.viewUser?.id
      || parentWidget?.viewPost?.id
      || parentWidget?.customView?.id
      || parentWidget?.viewTrack?.id
      || parentWidget?.viewFundingRound?.id
      || childWidget?.id?.includes('fake-id')
      || childWidget?.id === parentWidget?.id
      || (childWidgetIsContainer && parentWidgetIsContainer)
  )
}

export function isValidDropZone ({ overWidget, activeWidget, parentWidget, isOverlay = false, isEditing, droppableParams }) {
  const containerTypes = ['container', 'custom-views', 'chats', 'members', 'setup', 'auto-view', 'home']
  const isWrongType = overWidget?.type === 'home'
    || (parentWidget?.type === 'chats' && !activeWidget?.viewChat?.id)
    || (parentWidget?.type === 'custom-views' && !activeWidget?.customView?.id)
    || (parentWidget?.type === 'home')
  const parentWidgetIsContainer = containerTypes.includes(parentWidget?.type)
  const activeWidgetIsContainer = containerTypes.includes(activeWidget?.type)
  const isDynamicWidget = overWidget?.id?.includes('fake-id')
  // const listBottom = droppableParams.id?.includes('bottom-of-child-list')
  // console.log('--------------------------------')
  // console.log('overWidget.title', overWidget?.title + (listBottom ? ' (bottom of list)' : '') )
  // console.log('overWidget.type', overWidget?.type)
  // console.log('droppable.id', droppableParams?.id)
  // console.log('isValidDropZone ==>', (!activeWidgetIsContainer || !parentWidgetIsContainer) && (overWidget?.isDroppable || true) && isDroppable && !isWrongType && !isOverlay && isEditing)
  // console.log('parentWidget.type', parentWidget?.type)
  // console.log('activeWidget.type', activeWidget?.type)
  // console.log('parentWidgetIsContainer', parentWidgetIsContainer)
  // console.log('activeWidgetIsContainer', activeWidgetIsContainer)
  // console.log('overWidget.isDroppable', (overWidget?.isDroppable || true))
  // console.log('isWrongType', isWrongType)
  // console.log('isOverlay', isOverlay)
  // console.log('isEditing', isEditing)

  return (!activeWidgetIsContainer || !parentWidgetIsContainer)
    && (overWidget?.isDroppable || true)
    && !isWrongType
    && !isOverlay
    && isEditing
    && !isDynamicWidget
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
    id: 'fake-id-' + Math.floor(Math.random() * 1e9).toString()
  }
}

// Static widgets and widget data
const TERMS_AND_CONDITIONS_URL = 'https://hylo-landing.surge.sh/terms'

export const PUBLIC_CONTEXT_WIDGETS = [
  { type: 'home', url: '/public/stream' },
  { context: 'public', view: 'stream', title: 'widget-public-stream', id: 'widget-public-stream', order: 1, parentId: null },
  { context: 'public', view: 'groups', title: 'widget-public-groups', id: 'widget-public-groups', order: 2, parentId: null },
  { context: 'public', view: 'map', title: 'widget-public-map', id: 'widget-public-map', type: 'map', order: 3, parentId: null },
  { context: 'public', view: 'events', title: 'widget-public-events', id: 'widget-public-events', order: 4, parentId: null }
]

export const MY_CONTEXT_WIDGETS = (profileUrl) => [
  { type: 'home', url: '/my/posts' },
  { title: 'widget-my-groups-content', id: 'widget-my-groups-content', order: 2, parentId: null },
  { context: 'all', view: 'stream', title: 'widget-my-groups-stream', id: 'widget-my-groups-stream', order: 1, parentId: 'widget-my-groups-content' },
  { context: 'all', view: 'map', title: 'widget-my-groups-map', id: 'widget-my-groups-map', type: 'map', order: 2, parentId: 'widget-my-groups-content' },
  { context: 'all', view: 'events', title: 'widget-my-groups-events', id: 'widget-my-groups-events', order: 3, parentId: 'widget-my-groups-content' },
  { title: 'widget-my-content', id: 'widget-my-content', order: 1, parentId: null },
  { context: 'my', view: 'posts', iconName: 'Posticon', title: 'widget-my-posts', id: 'widget-my-posts', order: 1, parentId: 'widget-my-content' },
  { context: 'my', view: 'interactions', iconName: 'Support', title: 'widget-my-interactions', id: 'widget-my-interactions', order: 2, parentId: 'widget-my-content' },
  { context: 'my', view: 'mentions', iconName: 'Email', title: 'widget-my-mentions', id: 'widget-my-mentions', order: 3, parentId: 'widget-my-content' },
  { context: 'my', view: 'announcements', iconName: 'Announcement', title: 'widget-my-announcements', id: 'widget-my-announcements', order: 4, parentId: 'widget-my-content' },
  { context: 'my', view: 'saved-posts', iconName: 'Bookmark', title: 'widget-my-saved-posts', id: 'widget-my-saved-posts', order: 5, parentId: 'widget-my-content' },
  { context: 'my', view: 'tracks', iconName: 'Shapes', title: 'widget-my-tracks', id: 'widget-my-tracks', order: 5, parentId: 'widget-my-content' },
  { context: 'my', view: 'funding-rounds', iconName: 'BadgeDollarSign', title: 'widget-my-funding-rounds', id: 'widget-my-funding-rounds', order: 6, parentId: 'widget-my-content' },
  { title: 'widget-myself', id: 'widget-myself', order: 3, parentId: null },
  { title: 'widget-my-profile', id: 'widget-my-profile', url: profileUrl, order: 1, parentId: 'widget-myself' },
  { context: 'my', view: 'edit-profile', title: 'widget-my-edit-profile', id: 'widget-my-edit-profile', order: 2, parentId: 'widget-myself' },
  { context: 'my', view: 'groups', title: 'widget-my-groups', id: 'widget-my-groups', order: 3, parentId: 'widget-myself' },
  { context: 'my', view: 'invitations', title: 'widget-my-invites', id: 'widget-my-invites', order: 4, parentId: 'widget-myself' },
  { context: 'my', view: 'notifications', title: 'widget-my-notifications', id: 'widget-my-notifications', order: 5, parentId: 'widget-myself' },
  { context: 'my', view: 'locale', title: 'widget-my-locale', id: 'widget-my-locale', order: 6, parentId: 'widget-myself' },
  { context: 'my', view: 'blocked-users', title: 'widget-my-blocked-users', id: 'widget-my-blocked-users', order: 7, parentId: 'widget-myself' },
  { context: 'my', view: 'saved-searches', title: 'widget-my-saved-searches', id: 'widget-my-saved-searches', order: 8, parentId: 'widget-myself' },
  { context: 'my', view: 'account', title: 'widget-my-account', id: 'widget-my-account', order: 9, parentId: 'widget-myself' },
  { context: 'my', url: TERMS_AND_CONDITIONS_URL, title: 'widget-terms-and-conditions', id: 'widget-terms-and-conditions', order: 10, parentId: 'widget-myself' },
  { view: 'logout', title: 'widget-my-logout', id: 'widget-my-logout', type: 'logout', iconName: 'LogOut', order: 11, parentId: null }
]

export const allViewsWidget = ContextWidgetPresenter({ id: 'all-views', title: 'widget-all', type: 'all-views', view: 'all-views', iconName: 'Grid3x3', childWidgets: [] })

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
    defaultViewMode: 'calendar',
    postTypes: ['event'],
    defaultSortBy: 'start_time'
  },
  'funding-rounds': {
    name: 'Funding Rounds',
    iconName: 'BadgeDollarSign'
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
    defaultSortBy: 'created',
    defaultActivePostsOnly: true
  },
  resources: {
    name: 'Resources',
    iconName: 'Document',
    defaultViewMode: 'grid',
    postTypes: ['resource'],
    defaultSortBy: 'created'
  },
  roles: {
    name: 'Roles',
    iconName: 'Shield'
  },
  stream: {
    name: 'Stream',
    iconName: 'Stream',
    defaultViewMode: 'cards',
    defaultSortBy: 'created'
  },
  topics: {
    name: 'All Topics',
    iconName: 'Topics'
  },
  tracks: {
    name: 'Tracks',
    iconName: 'Shapes'
  },
  welcome: {
    name: 'Welcome',
    iconName: 'Hand'
  }
}
