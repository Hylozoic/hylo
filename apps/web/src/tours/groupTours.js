export const GROUP_CREATOR_TOUR_ID = 'group-creator'
export const GROUP_WELCOME_TOUR_ID = 'group-welcome'

/**
 * First landing in a group the user just created (sole member + administers).
 * Anchors live on GroupMenuHeader, the ContextMenu footer, and PostPrompt.
 */
export function groupCreatorTourSteps (t) {
  return [
    {
      element: '[data-tour="group-menu"]',
      popover: {
        title: t('Welcome to your new group'),
        description: t('Its menu, members, and settings all live in this panel.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="group-invite"]',
      popover: {
        title: t('Invite people'),
        description: t('Share an invite link or send email invites — a group starts with its people.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="edit-menu"]',
      popover: {
        title: t('Edit Menu'),
        description: t('Add views and spaces and drag to reorder them. The top item is what members see first.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="group-settings"]',
      popover: {
        title: t('Group Settings'),
        description: t('Privacy, agreements, join questions, and member roles are managed here.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="new-post"]',
      popover: {
        title: t('Start the first post'),
        description: t('Welcome new members with a discussion, or announce what this group is for.'),
        side: 'bottom'
      }
    }
  ]
}

/**
 * First landing in a group the user joined. Fires after the group welcome
 * modal (agreements / join questions) has been dismissed.
 */
export function groupWelcomeTourSteps (t) {
  return [
    {
      element: '[data-tour="group-menu"]',
      popover: {
        title: t('The group menu'),
        description: t('Each item is a view of this group. Spaces are sub-groups with their own members and content.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="new-post"]',
      popover: {
        title: t('Join the conversation'),
        description: t('Share a discussion, request, offer, or event with the group.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="group-notifications"]',
      popover: {
        title: t('Notification Settings'),
        description: t('Choose how this group reaches you: push, email, and digest frequency.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="group-about"]',
      popover: {
        title: t('About this group'),
        description: t("The group's purpose, agreements, and member directory live here."),
        side: 'right'
      }
    }
  ]
}
