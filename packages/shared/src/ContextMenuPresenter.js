const PUBLIC_CONTEXT_WIDGETS = [
  { context: 'public', title: 'widget-public-stream', id: 'widget-public-stream', view: 'stream', order: 1, parentId: null },
  { context: 'public', title: 'widget-public-groups', id: 'widget-public-groups', view: 'groups', order: 2, parentId: null },
  { context: 'public', title: 'widget-public-map', id: 'widget-public-map', view: 'map', type: 'map', order: 3, parentId: null },
  { context: 'public', title: 'widget-public-events', id: 'widget-public-events', view: 'events', order: 4, parentId: null }
]

const MY_CONTEXT_WIDGETS = (profileUrl) => [
  { title: 'widget-my-groups-content', id: 'widget-my-groups-content', order: 2, parentId: null },
  { title: 'widget-my-groups-stream', id: 'widget-my-groups-stream', context: 'all', view: 'stream', order: 1, parentId: 'widget-my-groups-content' },
  { title: 'widget-my-groups-map', id: 'widget-my-groups-map', context: 'all', view: 'map', type: 'map', order: 2, parentId: 'widget-my-groups-content' },
  { title: 'widget-my-groups-events', id: 'widget-my-groups-events', context: 'all', view: 'events', order: 3, parentId: 'widget-my-groups-content' },
  { title: 'widget-my-content', id: 'widget-my-content', order: 1, parentId: null },
  { icon: 'Posticon', title: 'widget-my-posts', id: 'widget-my-posts', view: 'posts', order: 1, parentId: 'widget-my-content', context: 'my' },
  { icon: 'Support', title: 'widget-my-interactions', id: 'widget-my-interactions', view: 'interactions', order: 2, parentId: 'widget-my-content', context: 'my' },
  { icon: 'Email', title: 'widget-my-mentions', id: 'widget-my-mentions', view: 'mentions', order: 3, parentId: 'widget-my-content', context: 'my' },
  { icon: 'Announcement', title: 'widget-my-announcements', id: 'widget-my-announcements', view: 'announcements', order: 4, parentId: 'widget-my-content', context: 'my' },
  { title: 'widget-myself', id: 'widget-myself', order: 3, parentId: null },
  { title: 'widget-my-profile', id: 'widget-my-profile', url: profileUrl, order: 1, parentId: 'widget-myself' },
  { title: 'widget-my-edit-profile', id: 'widget-my-edit-profile', context: 'my', view: 'edit-profile', order: 2, parentId: 'widget-myself' },
  { title: 'widget-my-groups', id: 'widget-my-groups', context: 'my', view: 'groups', order: 3, parentId: 'widget-myself' },
  { title: 'widget-my-invites', id: 'widget-my-invites', context: 'my', view: 'invitations', order: 4, parentId: 'widget-myself' },
  { title: 'widget-my-notifications', id: 'widget-my-notifications', context: 'my', view: 'notifications', order: 5, parentId: 'widget-myself' },
  { title: 'widget-my-locale', id: 'widget-my-locale', context: 'my', view: 'locale', order: 6, parentId: 'widget-myself' },
  { title: 'widget-my-account', id: 'widget-my-account', context: 'my', view: 'account', order: 7, parentId: 'widget-myself' },
  { title: 'widget-my-saved-searches', id: 'widget-my-saved-searches', context: 'my', view: 'saved-searches', order: 8, parentId: 'widget-myself' },
  { title: 'widget-my-logout', id: 'widget-my-logout', view: 'logout', type: 'logout', order: 4, parentId: null }
]

export function getStaticMenuWidgets ({ isPublic, isMyContext, profileUrl, isAllContext }) {
  let widgets = []

  if (isPublic) {
    widgets = PUBLIC_CONTEXT_WIDGETS
  }

  if (isMyContext || isAllContext) {
    widgets = MY_CONTEXT_WIDGETS(profileUrl)
  }

  return widgets
}

export const orderContextWidgetsForContextMenu = (contextWidgets) => {
  // Step 1: Filter out widgets without an order, as these are not displayed in the context menu
  const orderedWidgets = contextWidgets.filter(widget => widget.order !== null)

  // Step 2: Split into parentWidgets and childWidgets
  const parentWidgets = orderedWidgets.filter(widget => !widget?.parentId)
  const childWidgets = orderedWidgets.filter(widget => widget?.parentId)

  // Step 3: Add an empty array for childWidgets to each parentWidget
  parentWidgets.forEach(parent => {
    parent.childWidgets = []
  })

  // Step 4: Append each childWidget to the appropriate parentWidget
  childWidgets.forEach(child => {
    const parent = parentWidgets.find(parent => parent.id === child?.parentId)
    if (parent) {
      parent.childWidgets.push(child)
    }
  })

  // Step 5: Sort parentWidgets and each childWidgets array by order
  parentWidgets.sort((a, b) => a.order - b.order)
  parentWidgets.forEach(parent => {
    parent.childWidgets.sort((a, b) => a.order - b.order)
  })

  // Return the sorted parentWidgets with nested childWidgets
  return parentWidgets
}
