export const MENU_EDIT_TOUR_ID = 'menu-edit'

/**
 * First time in menu edit mode (?edit=true) — the surface where views and
 * spaces are created, reordered, and removed.
 */
export function menuEditTourSteps (t) {
  return [
    {
      element: '[data-tour="edit-menu-list"]',
      popover: {
        title: t('Reorder by dragging'),
        description: t('Drop items in the gaps between rows. The top item is the home view — what members see first.'),
        side: 'right'
      }
    },
    {
      element: '[data-tour="add-to-menu"]',
      popover: {
        title: t('Add to Menu'),
        description: t("Views show this group's content. Spaces are distinct places with their own members, content, and menu."),
        side: 'right'
      }
    },
    {
      element: '[data-tour="more-spaces"]',
      popover: {
        title: t('More Spaces'),
        description: t('Spaces removed from the menu land here — they are not deleted. Tracks and funding rounds live here too.'),
        side: 'right'
      }
    }
  ]
}
