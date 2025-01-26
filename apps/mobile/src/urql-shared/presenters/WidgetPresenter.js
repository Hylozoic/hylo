

// TODO redesign: - decide what to do with WidgetHelpers vs WidgetPresenter pattern
// either of which should be in a shared location. 

// This particular method is deprecated.
export function widgetToMobileNavObject ({ widget, destinationGroup }) {
  if (!widget) return null

  // Base navigation object for Home Tab screens
  const homeTabNav = ['Home Tab']

  // Handle different widget types and views
  if (widget.view === 'about') {
    return [...homeTabNav, {
      screen: 'Group Explore',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'stream') {
    return [...homeTabNav, {
      screen: 'Stream',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'map') {
    return [...homeTabNav, {
      screen: 'Map',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.view === 'members') {
    return [...homeTabNav, {
      screen: 'Members',
      params: { groupSlug: destinationGroup?.slug }
    }]
  }

  if (widget.viewChat) {
    return [...homeTabNav, {
      screen: 'Chat',
      params: { 
        topicName: widget.viewChat.name,
        groupSlug: destinationGroup?.slug 
      }
    }]
  }

  if (widget.viewPost) {
    return [...homeTabNav, {
      screen: 'Post Details',
      params: { id: widget.viewPost.id }
    }]
  }

  if (widget.viewUser) {
    return [...homeTabNav, {
      screen: 'Member',
      params: { 
        id: widget.viewUser.id,
        groupSlug: destinationGroup?.slug 
      }
    }]
  }

  if (widget.viewGroup) {
    return [...homeTabNav, {
      screen: 'Group Navigation',
      params: { groupSlug: widget.viewGroup.slug }
    }]
  }

  if (widget.customView) {
    return [...homeTabNav, {
      screen: 'Stream',
      params: { 
        customViewId: widget.customView.id,
        groupSlug: destinationGroup?.slug
      }
    }]
  }

  // TOOD redesign: need to add ask-and-offer screen to this
  switch (widget.view) {
    case 'projects':
      return [...homeTabNav, {
        screen: 'Projects',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'events':
      return [...homeTabNav, {
        screen: 'Events',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'decisions':
    case 'proposals':
      return [...homeTabNav, {
        screen: 'Decisions',
        params: { groupSlug: destinationGroup?.slug }
      }]
    case 'all-views':
      return [...homeTabNav, {
        screen: 'All Views',
        params: { groupSlug: destinationGroup?.slug }
      }]
    // My context views
    case 'posts':
      return [...homeTabNav, {
        screen: 'My Posts',
        params: { context: 'my' }
      }]
    case 'interactions':
      return [...homeTabNav, {
        screen: 'Interactions',
        params: { context: 'my' }
      }]
    case 'mentions':
      return [...homeTabNav, {
        screen: 'Mentions',
        params: { context: 'my' }
      }]
    case 'announcements':
      return [...homeTabNav, {
        screen: 'Announcements',
        params: { context: 'my' }
      }]
    case 'edit-profile':
      return [...homeTabNav, {
        screen: 'Edit Profile',
        params: { context: 'my' }
      }]
    case 'groups':
      return [...homeTabNav, {
        screen: widget.context === 'my' ? 'My Groups' : 'Groups',
        params: { context: widget.context || 'group', groupSlug: destinationGroup?.slug }
      }]
    case 'invitations':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users invitations
        screen: 'My Invitations',
        params: { context: 'my' }
      }]
    case 'notifications':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users Notifications Settings
        screen: 'My Notifications',
        params: { context: 'my' }
      }]
    case 'locale':
      return [...homeTabNav, { // TODO redesign: ensure this opens a language selector action menu
        screen: 'Language Settings',
        params: { context: 'my' }
      }]
    case 'account':
      return [...homeTabNav, { // TODO redesign: ensure this goes to the users Account Settings
        screen: 'Account Settings',
        params: { context: 'my' }
      }]
    case 'saved-searches':
      return [...homeTabNav, {
        screen: 'Saved Searches',
        params: { context: 'my' }
      }]
  }

  return null
}
