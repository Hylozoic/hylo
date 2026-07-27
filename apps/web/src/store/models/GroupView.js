import { attr, Model } from 'redux-orm'
import {
  POST_TYPE_TO_VIEW_TYPE,
  VIEW_TYPE_TO_POST_TYPES
} from '@hylo/shared'

/** Re-export system view defaults — defined in @hylo/presenters for package sharing. */
export { COMMON_VIEWS } from '@hylo/presenters/GroupViewPresenter'

export { POST_TYPE_TO_VIEW_TYPE, VIEW_TYPE_TO_POST_TYPES }

const NON_DELETABLE_TYPES = ['track-actions', 'funding-round-submissions']

/** Soft-removed from the menu (order = null) → More Views / Spaces; not hard-deleted. */
export const SOFT_REMOVE_VIEW_TYPES = new Set([
  'all',
  'about',
  'chat',
  'discussions',
  'events',
  'map',
  'members',
  'moderation',
  'projects',
  'proposals',
  'related-groups',
  'requests-and-offers',
  'resources',
  'space',
  'welcome'
])

/** Returns true when a view type is allowed by the group's acceptedPostTypes (null = all allowed). */
export function viewAcceptedByPostTypes (viewType, acceptedPostTypes) {
  if (acceptedPostTypes == null) return true
  const requiredPostTypes = VIEW_TYPE_TO_POST_TYPES[viewType]
  if (!requiredPostTypes) return true
  return requiredPostTypes.some(postType => acceptedPostTypes.includes(postType))
}

/** View types that have configurable settings in the menu editor. */
export function viewTypeHasSettings (type) {
  return ['chat', 'link', 'text', 'custom', 'collection', 'welcome', 'space'].includes(type)
}

/** Soft-removable system views use X (hide) instead of hard delete. */
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

/** Returns whether a view can be hard-deleted (custom/link/etc). */
export function canHardDeleteView (view) {
  return canDeleteView(view) && !isSoftRemoveView(view)
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
  lastReadPostId: attr()
}
