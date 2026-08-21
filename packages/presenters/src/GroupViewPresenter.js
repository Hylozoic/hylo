import { POST_TYPES } from './PostPresenter.js'

/** Default icon names for GroupView types (Hylo icon font or Lucide via GroupViewIcon). */
const VIEW_TYPE_TO_ICON_NAME = {
  about: 'Info',
  all: 'Stream',
  discussions: 'Message',
  events: 'Calendar',
  map: 'Globe',
  members: 'People',
  moderation: 'Shield',
  post: 'Posticon',
  proposals: 'Proposal',
  'related-groups': 'Groups',
  group: 'Groups',
  groups: 'Groups',
  'requests-and-offers': 'Request',
  resources: 'Document',
  stream: 'Stream',
  'track-actions': 'Shapes',
  tracks: 'Shapes',
  welcome: 'Hand',
  custom: 'Filter'
}

/**
 * Defaults for built-in / system GroupView types (labels, icons, stream filters).
 * Shared by web ViewContent and packages (e.g. useStreamQueryVariables).
 */
export const COMMON_VIEWS = {
  all: {
    name: 'All Activity',
    iconName: 'Stream',
    defaultViewMode: 'cards',
    defaultSortBy: 'created'
  },
  proposals: {
    name: 'Proposals',
    iconName: 'Proposal',
    lucideIcon: 'Vote',
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
    name: 'Active Members',
    iconName: 'People'
  },
  moderation: {
    name: 'Moderation',
    iconName: 'Shield',
    lucideIcon: 'ShieldCheck'
  },
  projects: {
    name: 'Projects',
    iconName: 'Layers',
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
  'track-actions': {
    name: 'Actions',
    iconName: 'Shapes',
    postTypes: ['action']
  },
  'funding-round-submissions': {
    name: 'Submissions',
    iconName: 'ClipboardList',
    postTypes: ['submission']
  },
  welcome: {
    name: 'Welcome',
    iconName: 'Hand'
  }
}

/** View types that use a Lucide icon instead of the Hylo icon font. */
const VIEW_TYPE_TO_LUCIDE_ICON = {
  all: 'Activity',
  chat: 'MessageCircleMore',
  collection: 'Layers',
  'space-collection': 'Boxes',
  'funding-round-submissions': 'ClipboardList',
  'manage-round': 'Settings',
  link: 'ExternalLink',
  map: 'Map',
  member: 'User',
  members: 'Users',
  moderation: 'ShieldCheck',
  projects: 'Layers',
  proposals: 'Vote',
  'related-groups': 'Network',
  resources: 'PackageOpen',
  'requests-and-offers': 'Heart',
  text: 'Type',
  separator: 'Minus'
}

/** Explicit icon names that map to Lucide (not the Hylo icon font). */
const LUCIDE_ICON_NAMES = new Set([
  'BadgeDollarSign',
  'Bell',
  'Bookmark',
  'Boxes',
  'ClipboardList',
  'CreditCard',
  'Edit',
  'ExternalLink',
  'FilePenLine',
  'Grid3x3',
  'Languages',
  'Layers',
  'LogOut',
  'Mail',
  'MessageCircleMore',
  'MessageSquareMore',
  'Minus',
  'Network',
  'Palette',
  'Search',
  'Settings',
  'Shapes',
  'Shield',
  'ShieldCheck',
  'Type',
  'User',
  'UserX',
  'Users',
  'Vote'
])

/** Translates a stored view name when it is a view-* or widget-* locale key. */
export function translateViewName (name, t) {
  if (!name) return name
  if (name.startsWith('view-') || name.startsWith('widget-')) return t(name)
  return name
}

const DEFAULT_GROUP_AVATAR = '/default-group-avatar.svg'

/** Returns whether a group has a non-default custom avatar URL. */
function groupHasCustomAvatar (avatarUrl) {
  return Boolean(
    avatarUrl &&
    avatarUrl !== DEFAULT_GROUP_AVATAR &&
    !avatarUrl.endsWith('/default-group-avatar.svg')
  )
}

/** Resolves avatar data for member/group/space type views. */
export function avatarForView (view) {
  if (view?.type === 'member' && view.viewUser) {
    return { avatarUrl: view.viewUser.avatarUrl, displayName: view.viewUser.name }
  }
  if (view?.type === 'group' && view.linkedGroup) {
    return { avatarUrl: view.linkedGroup.avatarUrl, displayName: view.linkedGroup.name }
  }
  if (view?.type === 'space' && view.linkedGroup && groupHasCustomAvatar(view.linkedGroup.avatarUrl)) {
    return {
      avatarUrl: view.linkedGroup.avatarUrl,
      displayName: view.linkedGroup.name
    }
  }
  return null
}

/** Resolves the icon for a view — DB override, linked space group icon, then type default. */
export function iconForView (view) {
  if (view?.icon) {
    if (LUCIDE_ICON_NAMES.has(view.icon) || view.type === 'custom' || view.type === 'collection' || view.type === 'space-collection' || view.type === 'space' || view.type === 'link' || view.type === 'logout') {
      return { iconName: null, lucideIcon: view.icon }
    }
    return { iconName: view.icon, lucideIcon: null }
  }
  // Space group icons are always picked from Lucide (LucideIconPicker), so they
  // aren't restricted to LUCIDE_ICON_NAMES — that set only disambiguates icons
  // stored on views, which can still hold legacy Hylo icon font names.
  if (view?.type === 'space' && view.linkedGroup?.icon && !groupHasCustomAvatar(view.linkedGroup.avatarUrl)) {
    return { iconName: null, lucideIcon: view.linkedGroup.icon }
  }
  if (view?.type === 'logout') {
    return { iconName: null, lucideIcon: 'LogOut' }
  }
  // Post views take the shared post's type icon (discussion, request, event, …)
  if (view?.type === 'post' && POST_TYPES[view.viewPost?.type]?.iconName) {
    return { iconName: POST_TYPES[view.viewPost.type].iconName, lucideIcon: null }
  }
  if (VIEW_TYPE_TO_LUCIDE_ICON[view?.type]) {
    return { iconName: null, lucideIcon: VIEW_TYPE_TO_LUCIDE_ICON[view.type] }
  }
  const iconName = VIEW_TYPE_TO_ICON_NAME[view?.type] || null
  return { iconName, lucideIcon: null }
}

/**
 * Human-readable menu label for a GroupView.
 * Optional `spaceGroup` supplies track/funding-round unit terms for nested space views.
 */
export function displayNameForView (view, t, { spaceGroup } = {}) {
  if (view?.type === 'post' && view.viewPost?.title) return view.viewPost.title
  if (view?.type === 'member' && view.viewUser?.name) return view.viewUser.name
  if (view?.type === 'group' && view.linkedGroup?.name) return view.linkedGroup.name
  if (view?.type === 'text') {
    if (view.pageContent) return view.pageContent
    if (view.name) return translateViewName(view.name, t)
  }
  // Space menu labels always follow the space group name (not a stale view.name snapshot).
  if (view?.type === 'space') {
    return view.linkedGroup?.name || (view.name ? translateViewName(view.name, t) : undefined)
  }
  if (view?.name) return translateViewName(view.name, t)

  // Default type labels for track/FR content views use the configured unit term.
  if (view?.type === 'funding-round-submissions') {
    const plural = spaceGroup?.fundingRound?.submissionDescriptorPlural ||
      view.linkedGroup?.fundingRound?.submissionDescriptorPlural
    if (plural) return plural
  }
  if (view?.type === 'track-actions') {
    const plural = spaceGroup?.track?.actionDescriptorPlural ||
      view.linkedGroup?.track?.actionDescriptorPlural
    if (plural) return plural
  }

  if (view?.type) return translateViewName(`view-${view.type}`, t)
  return ''
}

/** Static menu views for the Public context (The Commons). */
export const PUBLIC_CONTEXT_VIEWS = [
  { type: 'stream', context: 'public', icon: 'Stream', name: 'view-public-stream', id: 'view-public-stream', order: 1 },
  { type: 'groups', context: 'public', icon: 'Groups', name: 'view-public-groups', id: 'view-public-groups', order: 2 },
  { type: 'map', context: 'public', name: 'view-public-map', id: 'view-public-map', order: 3 },
  { type: 'events', context: 'public', name: 'view-public-events', id: 'view-public-events', order: 4 }
]

/**
 * Static menu views for the My (and All My Groups) context.
 * Flat ordered list with text headers as section breaks (same shape as group menus).
 */
export const MY_CONTEXT_VIEWS = (profileUrl) => [
  { type: 'stream', context: 'all', name: 'view-my-groups-stream', id: 'view-my-groups-stream', order: 1 },
  { type: 'map', context: 'all', name: 'view-my-groups-map', id: 'view-my-groups-map', order: 2 },
  { type: 'events', context: 'all', name: 'view-my-groups-events', id: 'view-my-groups-events', order: 3 },
  { type: 'text', name: 'view-my-content', id: 'view-my-content', order: 4 },
  { type: 'posts', context: 'my', icon: 'Posticon', name: 'view-my-posts', id: 'view-my-posts', order: 5 },
  { type: 'drafts', context: 'my', icon: 'FilePenLine', name: 'view-my-drafts', id: 'view-my-drafts', order: 6 },
  { type: 'interactions', context: 'my', icon: 'Support', name: 'view-my-interactions', id: 'view-my-interactions', order: 7 },
  { type: 'mentions', context: 'my', icon: 'Email', name: 'view-my-mentions', id: 'view-my-mentions', order: 8 },
  { type: 'saved-posts', context: 'my', icon: 'Bookmark', name: 'view-my-saved-posts', id: 'view-my-saved-posts', order: 9 },
  { type: 'tracks', context: 'my', icon: 'Shapes', name: 'view-my-tracks', id: 'view-my-tracks', order: 10 },
  { type: 'funding-rounds', context: 'my', icon: 'BadgeDollarSign', name: 'view-my-funding-rounds', id: 'view-my-funding-rounds', order: 11 },
  { type: 'text', name: 'view-myself', id: 'view-myself', order: 12 },
  { type: 'link', name: 'view-my-profile', link: profileUrl, icon: 'User', id: 'view-my-profile', order: 13 },
  { type: 'edit-profile', context: 'my', icon: 'Edit', name: 'view-my-edit-profile', id: 'view-my-edit-profile', order: 14 },
  { type: 'groups', context: 'my', icon: 'Users', name: 'view-my-groups', id: 'view-my-groups', order: 15 },
  { type: 'invitations', context: 'my', icon: 'Mail', name: 'view-my-invites', id: 'view-my-invites', order: 16 },
  { type: 'transactions', context: 'my', icon: 'CreditCard', name: 'view-my-transactions', id: 'view-my-transactions', order: 17 },
  { type: 'notifications', context: 'my', icon: 'Bell', name: 'view-my-notifications', id: 'view-my-notifications', order: 18 },
  { type: 'appearance', context: 'my', icon: 'Palette', name: 'view-my-appearance', id: 'view-my-appearance', order: 19 },
  { type: 'locale', context: 'my', icon: 'Languages', name: 'view-my-locale', id: 'view-my-locale', order: 20 },
  { type: 'blocked-users', context: 'my', icon: 'UserX', name: 'view-my-blocked-users', id: 'view-my-blocked-users', order: 21 },
  { type: 'saved-searches', context: 'my', icon: 'Search', name: 'view-my-saved-searches', id: 'view-my-saved-searches', order: 22 },
  { type: 'account', context: 'my', icon: 'Shield', name: 'view-my-account', id: 'view-my-account', order: 23 },
  { type: 'logout', name: 'view-my-logout', icon: 'LogOut', id: 'view-my-logout', order: 24 }
]

/** Returns static menu views for My Home or Public contexts. */
export function getStaticMenuViews ({ isPublicContext, isMyContext, profileUrl }) {
  if (isPublicContext) return PUBLIC_CONTEXT_VIEWS
  if (isMyContext) return MY_CONTEXT_VIEWS(profileUrl)
  return null
}

/**
 * Synthetic menu item for Funding Round spaces — not stored in the DB.
 * Always rendered at the bottom of the space menu for stewards who can manage spaces.
 */
export const MANAGE_ROUND_VIEW = {
  type: 'manage-round',
  id: 'view-manage-round',
  name: 'view-manage-round',
  icon: 'Settings',
  order: Number.MAX_SAFE_INTEGER
}

/** Present a GroupView with resolved display helpers for the navigation menu. */
export default function GroupViewPresenter (view) {
  if (!view || view._presented) return view

  const avatar = avatarForView(view)
  const icon = iconForView(view)

  return {
    ...view,
    avatarUrl: avatar?.avatarUrl,
    avatarDisplayName: avatar?.displayName,
    iconName: icon.iconName,
    lucideIcon: icon.lucideIcon,
    _presented: true
  }
}
