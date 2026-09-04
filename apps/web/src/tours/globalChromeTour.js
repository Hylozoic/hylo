export const GLOBAL_CHROME_TOUR_ID = 'global-chrome'

/**
 * First-session tour of the global navigation rail. Anchors are `data-tour`
 * attributes on the GlobalNav tiles; steps whose anchor is missing (compact
 * layouts) are skipped by useTour.
 */
export function globalChromeTourSteps (t, { sandboxMode = false } = {}) {
  const steps = []

  if (sandboxMode) {
    steps.push({
      popover: {
        title: t('Hylo Demo'),
        description: t("You're exploring a demo. Changes aren't saved."),
        side: 'bottom'
      }
    })
  }

  steps.push(
    {
      element: '[data-tour="my-home"]',
      popover: {
        title: t('My Home'),
        description: t('Your personal corner of Hylo: activity from all your groups, your posts, and your profile.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="activity"]',
      popover: {
        title: t('Activity'),
        description: t('Notifications from your groups land here.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="messages"]',
      popover: {
        title: t('Messages'),
        description: t('Direct message anyone who shares a group with you.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="the-commons"]',
      popover: {
        title: t('The Commons'),
        description: t('Explore public groups, posts, events, and the map.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="create"]',
      popover: {
        title: t('Create'),
        description: t('Start a post, a group, or a direct message from anywhere.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="help"]',
      popover: {
        title: t('Help'),
        description: t('Find the user guide here, or take this tour again any time.'),
        side: 'right'
      }
    }
  )

  return steps
}
