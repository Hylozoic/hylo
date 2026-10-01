import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useTour from './useTour'
import { TOUR_LAYOUT_GRID } from './layouts'

export const GROUP_CREATOR_TOUR_ID = 'group-creator'
export const GROUP_WELCOME_TOUR_ID = 'group-welcome'

// In the card menu (ContextMenuGrid) the group's controls sit in the banner
// across the top of the page, and the cards fill the page below it
const BELOW = { [TOUR_LAYOUT_GRID]: { popover: { side: 'bottom', align: 'center' } } }
const BELOW_LEFT = { [TOUR_LAYOUT_GRID]: { popover: { side: 'bottom', align: 'start' } } }
const BELOW_RIGHT = { [TOUR_LAYOUT_GRID]: { popover: { side: 'bottom', align: 'end' } } }

/**
 * First landing in a group the user just created (sole member + administers).
 * Anchors live on GroupMenuHeader, the ContextMenu footer and PostPrompt in
 * the sidebar layout, and on the ContextMenuGrid banner and cards in the card
 * menu layout.
 */
export function groupCreatorTourSteps (t) {
  return [
    {
      element: '[data-tour="group-menu"]',
      popover: {
        title: t('Welcome to your new group'),
        description: t('Its menu, members, and settings all live in this panel.'),
        side: 'right'
      },
      variants: {
        [TOUR_LAYOUT_GRID]: {
          popover: {
            description: t('This page is your group\'s menu: each card opens a view or a space. Members and settings are in the banner above.'),
            side: 'top',
            align: 'start'
          }
        }
      }
    },
    {
      element: '[data-tour="group-invite"]',
      popover: {
        title: t('Invite people'),
        description: t('Share an invite link or send email invites — a group starts with its people.'),
        side: 'right'
      },
      variants: BELOW
    },
    {
      element: '[data-tour="edit-menu"]',
      popover: {
        title: t('Edit Menu'),
        description: t('Add views and spaces and drag to reorder them. The top item is what members see first.'),
        side: 'right'
      },
      variants: {
        [TOUR_LAYOUT_GRID]: {
          popover: {
            description: t('Add views and spaces and drag the cards to reorder them. The first card is what members see first.'),
            side: 'top',
            align: 'center'
          }
        }
      }
    },
    {
      element: '[data-tour="group-settings"]',
      popover: {
        title: t('Group Settings'),
        description: t('Privacy, agreements, join questions, and member roles are managed here.'),
        side: 'right'
      },
      variants: BELOW_RIGHT
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
 * modal (agreements / join questions) has been dismissed. The invite step only
 * shows to members who can invite: the invite control renders nothing for
 * everyone else, so useTour skips that step.
 */
export function groupWelcomeTourSteps (t) {
  return [
    {
      element: '[data-tour="group-menu"]',
      popover: {
        title: t('The group menu'),
        description: t('Each item is a view of this group. Spaces are sub-groups with their own members and content.'),
        side: 'right'
      },
      variants: {
        [TOUR_LAYOUT_GRID]: {
          popover: {
            description: t('Each card is a view of this group. Spaces are sub-groups with their own members and content.'),
            side: 'top',
            align: 'start'
          }
        }
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
      },
      variants: BELOW_LEFT
    },
    {
      element: '[data-tour="group-about"]',
      popover: {
        title: t('About this group'),
        description: t("The group's purpose, agreements, and member directory live here."),
        side: 'right'
      },
      variants: BELOW
    },
    {
      element: '[data-tour="group-invite"]',
      popover: {
        title: t('Bring people in'),
        description: t('Know someone who belongs here? Invite them to join the group.'),
        side: 'right'
      },
      variants: BELOW
    }
  ]
}

/**
 * The group's first-visit tour, offered by a floating invitation: the creator
 * of a brand-new group (sole member, administers) gets the steward tour and
 * everyone else the member tour. Held until the group welcome modal
 * (agreements / join questions) closes. Used by both group menus: the sidebar
 * (ContextMenu) and the card menu (ContextMenuGrid).
 */
export function useGroupTour ({ group, canAdminister, enabled }) {
  const { t } = useTranslation()
  const isNewlyCreatedGroup = Boolean(canAdminister && group?.memberCount === 1)
  const steps = useMemo(
    () => isNewlyCreatedGroup ? groupCreatorTourSteps(t) : groupWelcomeTourSteps(t),
    [isNewlyCreatedGroup, t]
  )
  return useTour({
    id: isNewlyCreatedGroup ? GROUP_CREATOR_TOUR_ID : GROUP_WELCOME_TOUR_ID,
    steps,
    autoStart: true,
    inviteMessage: isNewlyCreatedGroup
      ? t('Your group is ready — want a quick tour?')
      : t('New here? Take a quick tour of this group.'),
    enabled: Boolean(enabled && group?.id),
    blockedBySelectors: ['[data-testid="group-welcome-modal"]']
  })
}
