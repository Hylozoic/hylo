/** All post types available for custom view filters (requests & offers are one pill). */
export const CUSTOM_VIEW_DEFAULT_POST_TYPES = [
  'discussion',
  'event',
  'resource',
  'project',
  'proposal',
  'request',
  'offer'
]

export const CUSTOM_VIEW_POST_TYPE_OPTIONS = [
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
  { value: 'cards', labelKey: 'Stream', defaultLabel: 'Stream' },
  { value: 'list', labelKey: 'List', defaultLabel: 'List' },
  { value: 'grid', labelKey: 'Grid', defaultLabel: 'Grid' },
  { value: 'bigGrid', labelKey: 'Big Grid', defaultLabel: 'Big Grid' },
  { value: 'calendar', labelKey: 'Calendar', defaultLabel: 'Calendar' },
  { value: 'map', labelKey: 'Map', defaultLabel: 'Map' }
]
