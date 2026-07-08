import { attr, Model } from 'redux-orm'

const NON_DELETABLE_TYPES = ['track-actions', 'funding-round-submissions']

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
