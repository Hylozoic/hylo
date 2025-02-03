export default function CustomViewPresenter (customView, { t }) {
  if (!customView || customView?._presented) return customView

  return {
    ...customView,
    // add attributes
    _presented: true
  }
}

/* == Attribute Resolvers == */

// Add resolvers for generating the presenter attributes, name in the form of <attributeName>Resolver

/* == ContextWidget collection and utility functions == */

export const COMMON_VIEWS = {
  'ask-and-offer': {
    name: 'Ask & Offer',
    iconName: 'Request',
    defaultViewMode: 'bigGrid',
    postTypes: ['request', 'offer'],
    defaultSortBy: 'created'
  },
  decisions: {
    name: 'Decisions',
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
    defaultViewMode: 'cards',
    postTypes: ['event'],
    defaultSortBy: 'start_time'
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
  projects: {
    name: 'Projects',
    iconName: 'Stack',
    defaultViewMode: 'bigGrid',
    postTypes: ['project'],
    defaultSortBy: 'created'
  },
  stream: {
    name: 'Stream',
    iconName: 'Stream',
    defaultViewMode: 'cards',
    defaultSortBy: 'created'
  }
}
