/** Default icon names for GroupView types (Hylo icon font or Lucide via GroupViewIcon). */
const VIEW_TYPE_TO_ICON_NAME = {
  about: 'Info',
  all: 'Stream',
  collection: 'Stack',
  discussions: 'Message',
  events: 'Calendar',
  'funding-round-submissions': 'BadgeDollarSign',
  map: 'Globe',
  members: 'People',
  moderation: 'Shield',
  post: 'Posticon',
  projects: 'Stack',
  proposals: 'Proposal',
  'related-groups': 'Groups',
  'requests-and-offers': 'Request',
  resources: 'Document',
  'track-actions': 'Shapes',
  tracks: 'Shapes',
  welcome: 'Hand',
  custom: 'Filter'
}

/** View types that use a Lucide icon instead of the Hylo icon font. */
const VIEW_TYPE_TO_LUCIDE_ICON = {
  chat: 'MessageCircleMore',
  link: 'ExternalLink',
  text: 'Type',
  separator: 'Minus'
}

/** Translates a stored view name when it is a view-* or widget-* locale key. */
export function translateViewName (name, t) {
  if (!name) return name
  if (name.startsWith('view-') || name.startsWith('widget-')) return t(name)
  return name
}

/** Resolves avatar data for member/group type views. */
export function avatarForView (view) {
  if (view?.type === 'member' && view.viewUser) {
    return { avatarUrl: view.viewUser.avatarUrl, displayName: view.viewUser.name }
  }
  if (view?.type === 'group' && view.linkedGroup) {
    return { avatarUrl: view.linkedGroup.avatarUrl, displayName: view.linkedGroup.name }
  }
  return null
}

/** Resolves the icon for a view — DB override, then type default. */
export function iconForView (view) {
  if (view?.icon) {
    if (view.type === 'custom' || view.type === 'space' || view.type === 'link') {
      return { iconName: null, lucideIcon: view.icon }
    }
    return { iconName: view.icon, lucideIcon: null }
  }
  if (VIEW_TYPE_TO_LUCIDE_ICON[view?.type]) {
    return { iconName: null, lucideIcon: VIEW_TYPE_TO_LUCIDE_ICON[view.type] }
  }
  const iconName = VIEW_TYPE_TO_ICON_NAME[view?.type] || null
  return { iconName, lucideIcon: null }
}

/** Human-readable menu label for a GroupView. */
export function displayNameForView (view, t) {
  if (view?.type === 'post' && view.viewPost?.title) return view.viewPost.title
  if (view?.type === 'member' && view.viewUser?.name) return view.viewUser.name
  if (view?.type === 'group' && view.linkedGroup?.name) return view.linkedGroup.name
  if (view?.type === 'text' && view.pageContent) return view.pageContent
  if (view?.type === 'space') {
    return view.name ? translateViewName(view.name, t) : view.linkedGroup?.name
  }
  if (view?.name) return translateViewName(view.name, t)
  if (view?.type) return translateViewName(`view-${view.type}`, t)
  return ''
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
