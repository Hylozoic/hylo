/** Post type strings selected by default for a new custom view, group, or space. */
export const DEFAULT_SELECTED_POST_TYPES = [
  'discussion',
  'event',
  'resource',
  'project',
  'proposal',
  'request',
  'offer'
]

/** Pills in the custom stream form. Request and offer are separate pills. */
export const CUSTOM_STREAM_POST_TYPE_PILLS = [
  { key: 'discussion', postTypes: ['discussion'], labelKey: 'view-discussions' },
  { key: 'event', postTypes: ['event'], labelKey: 'view-events' },
  { key: 'resource', postTypes: ['resource'], labelKey: 'view-resources' },
  { key: 'project', postTypes: ['project'], labelKey: 'view-projects' },
  { key: 'proposal', postTypes: ['proposal'], labelKey: 'view-proposals' },
  { key: 'request', postTypes: ['request'], labelKey: 'view-requests' },
  { key: 'offer', postTypes: ['offer'], labelKey: 'view-offers' }
]

/** Pills for a group or space's accepted post types. Request and offer share one pill. */
export const ACCEPTED_POST_TYPE_PILLS = [
  { key: 'discussion', postTypes: ['discussion'], labelKey: 'view-discussions' },
  { key: 'event', postTypes: ['event'], labelKey: 'view-events' },
  { key: 'resource', postTypes: ['resource'], labelKey: 'view-resources' },
  { key: 'project', postTypes: ['project'], labelKey: 'view-projects' },
  { key: 'proposal', postTypes: ['proposal'], labelKey: 'view-proposals' },
  { key: 'requests-and-offers', postTypes: ['request', 'offer'], labelKey: 'view-requests-and-offers' }
]

/** Stored in group_views.settings.defaultViewMode (cards = stream/card view). */
export const CUSTOM_VIEW_DEFAULT_VIEW_MODE = 'cards'

export const CUSTOM_VIEW_VIEW_MODE_OPTIONS = [
  { value: 'cards', labelKey: 'Card', defaultLabel: 'Card' },
  { value: 'list', labelKey: 'List', defaultLabel: 'List' },
  { value: 'bigGrid', labelKey: 'Large Grid', defaultLabel: 'Large Grid' },
  { value: 'grid', labelKey: 'Small Grid', defaultLabel: 'Small Grid' },
  { value: 'calendar', labelKey: 'Calendar', defaultLabel: 'Calendar' }
  // TODO from assistant: temporarily hidden while the Map view mode is in progress
  // { value: 'map', labelKey: 'Map', defaultLabel: 'Map' }
]
