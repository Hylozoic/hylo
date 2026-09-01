import { attr, Model } from 'redux-orm'
import {
  POST_TYPE_TO_VIEW_TYPE,
  VIEW_TYPE_TO_POST_TYPES
} from '@hylo/shared'

/** Re-export system view defaults — defined in @hylo/presenters for package sharing. */
export { COMMON_VIEWS } from '@hylo/presenters/GroupViewPresenter'

export { POST_TYPE_TO_VIEW_TYPE, VIEW_TYPE_TO_POST_TYPES }

/** Stands in for a home view that isn't one of the picker's own options — the backend
 * takes the landing route from the first seeded view, so any menu item can hold the spot. */
export const CUSTOM_HOME_VIEW = 'CUSTOM'

const NON_DELETABLE_TYPES = ['track-actions', 'funding-round-submissions']

/**
 * Can soft-remove from the menu (order = null) → More Spaces.
 * Only spaces can live off-menu. Views are in the menu or deleted.
 */
export const SOFT_REMOVE_VIEW_TYPES = new Set([
  'space'
])

/** Types that cannot be the group's home view (no navigable route / not a landing page). */
export const NON_HOME_VIEW_TYPES = new Set([
  'link',
  'text',
  'separator',
  'space'
])

/** Returns true when a view type is allowed by the group's acceptedPostTypes (null = all allowed). */
export function viewAcceptedByPostTypes (viewType, acceptedPostTypes) {
  if (acceptedPostTypes == null) return true
  const requiredPostTypes = VIEW_TYPE_TO_POST_TYPES[viewType]
  if (!requiredPostTypes) return true
  return requiredPostTypes.some(postType => acceptedPostTypes.includes(postType))
}

/** True when a persisted view belongs on the live or edit menu. */
export function isMenuViewVisible (view, acceptedPostTypes) {
  if (view?.order == null) return false
  return viewAcceptedByPostTypes(view.type, acceptedPostTypes)
}

/** View types that have configurable settings in the menu editor. */
export function viewTypeHasSettings (type) {
  return ['all', 'chat', 'link', 'text', 'custom', 'collection', 'space-collection', 'welcome', 'space'].includes(type)
}

/** Soft-removable items use X to move to More Spaces (spaces only). */
export function isSoftRemoveView (view) {
  return SOFT_REMOVE_VIEW_TYPES.has(view?.type)
}

/** Returns whether a view can be removed from the menu (soft or hard). */
export function canDeleteView (view) {
  if (!view?.id) return false
  if (view.order === 0) return false
  if (NON_DELETABLE_TYPES.includes(view.type)) return false
  return true
}

/** Returns whether a view can be permanently deleted (trash). Spaces use deleteSpace. */
export function canHardDeleteView (view) {
  return canDeleteView(view)
}

/** Returns whether this view type is allowed as the group/space home view. */
export function canBeHomeView (view) {
  return Boolean(view?.type) && !NON_HOME_VIEW_TYPES.has(view.type)
}

/** Returns whether the "Set as Home View" action should be offered for this view. */
export function canSetAsHomeView (view) {
  if (!view?.id) return false
  if (view.order === 0) return false
  return canBeHomeView(view)
}

/** Seeds the menu in this order, with the chosen home view first so the landing route matches.
 * `orderedStandardTypes` is empty until Menu Items is opened, so we fall back to the derived defaults. */
export function viewTypesForCreate (orderedStandardTypes, defaultTypes, homeType) {
  const types = orderedStandardTypes.length > 0 ? orderedStandardTypes : defaultTypes
  if (types.length === 0) return [homeType || 'all']
  if (homeType && types.includes(homeType) && types[0] !== homeType) {
    return [homeType, ...types.filter(type => type !== homeType)]
  }
  return types
}

class GroupView extends Model {
  toString () {
    return `GroupView: ${this.name || this.type}`
  }
}

export default GroupView

GroupView.modelName = 'GroupView'

GroupView.fields = {
  id: attr(),
  type: attr(),
  name: attr(),
  order: attr(),
  icon: attr(),
  link: attr(),
  pageContent: attr(),
  topics: attr(),
  settings: attr(),
  newPostCount: attr(),
  lastReadPostId: attr(),
  pinnedPostIds: attr(),
  pinnedPosts: attr()
}
