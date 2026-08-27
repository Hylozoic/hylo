export const GROUP_SETTINGS_TOUR_ID = 'group-settings'

/** First open of group settings — orientation over the section nav. */
export function groupSettingsTourSteps (t) {
  return [
    {
      element: '[data-tour="settings-nav"]',
      popover: {
        title: t('Group Settings'),
        description: t('Everything about how this group works is managed from these sections.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="settings-nav-privacy"]',
      popover: {
        title: t('Two separate dials'),
        description: t('Who can see the group and who can join it are set independently — check both.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="settings-nav-roles"]',
      popover: {
        title: t('Roles carry powers'),
        description: t('Responsibilities are the powers, roles bundle them, and members hold roles.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="settings-nav-invite"]',
      popover: {
        title: t('Three ways to invite'),
        description: t('A public link, a join link that skips approval, and email invites that can pre-assign a role.'),
        side: 'right'
      }
    }
  ]
}
