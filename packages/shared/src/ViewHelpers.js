export const COMMON_VIEWS = {
  'ask-and-offer': {
    name: 'Ask & Offer',
    icon: 'Request',
    defaultViewMode: 'bigGrid',
    postTypes: ['request', 'offer'],
    defaultSortBy: 'created'
  },
  decisions: {
    name: 'Decisions',
    icon: 'Proposal',
    defaultViewMode: 'cards',
    postTypes: ['proposal'],
    defaultSortBy: 'created'
  },
  discussions: {
    name: 'Discussions',
    icon: 'Message',
    defaultViewMode: 'list',
    postTypes: ['discussion'],
    defaultSortBy: 'updated'
  },
  events: {
    name: 'Events',
    icon: 'Calendar',
    defaultViewMode: 'cards',
    postTypes: ['event'],
    defaultSortBy: 'start_time'
  },
  groups: {
    name: 'Groups',
    icon: 'Groups'
  },
  map: {
    name: 'Map',
    icon: 'Globe'
  },
  members: {
    name: 'Members',
    icon: 'People'
  },
  projects: {
    name: 'Projects',
    icon: 'Stack',
    defaultViewMode: 'bigGrid',
    postTypes: ['project'],
    defaultSortBy: 'created'
  },
  resources: {
    name: 'Resources',
    icon: 'Document',
    defaultViewMode: 'grid',
    postTypes: ['resource'],
    defaultSortBy: 'created'
  },
  stream: {
    name: 'Stream',
    icon: 'Stream'
  }
}
