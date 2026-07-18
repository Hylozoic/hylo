import { attr, Model } from 'redux-orm'

const NON_DELETABLE_TYPES = ['track-actions', 'funding-round-submissions']

/** Maps an accepted post type to the GroupView type that displays it (mirrors backend Group.ACCEPTED_POST_TYPE_TO_VIEW_TYPE). */
export const POST_TYPE_TO_VIEW_TYPE = {
  discussion: 'discussions',
  event: 'events',
  resource: 'resources',
  project: 'projects',
  proposal: 'proposals',
  offer: 'requests-and-offers',
  request: 'requests-and-offers'
}

/** Inverse of POST_TYPE_TO_VIEW_TYPE — the post type(s) that make a given view type relevant. */
export const VIEW_TYPE_TO_POST_TYPES = Object.entries(POST_TYPE_TO_VIEW_TYPE).reduce((acc, [postType, viewType]) => {
  acc[viewType] = [...(acc[viewType] || []), postType]
  return acc
}, {})

/** Returns true when a view type is allowed by the group's acceptedPostTypes (null = all allowed). */
export function viewAcceptedByPostTypes (viewType, acceptedPostTypes) {
  if (acceptedPostTypes == null) return true
  const requiredPostTypes = VIEW_TYPE_TO_POST_TYPES[viewType]
  if (!requiredPostTypes) return true
  return requiredPostTypes.some(postType => acceptedPostTypes.includes(postType))
}

/** View types that have configurable settings in the menu editor. */
export function viewTypeHasSettings (type) {
  return ['chat', 'link', 'text', 'custom', 'welcome', 'space'].includes(type)
}

/** Returns whether a view can be removed from the menu. */
export function canDeleteView (view) {
  if (!view?.id) return false
  if (view.order === 0) return false
  if (NON_DELETABLE_TYPES.includes(view.type)) return false
  return true
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
