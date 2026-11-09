export const STREAM_TOUR_ID = 'stream-controls'

/** First stream visit — the icon-only control row. */
export function streamTourSteps (t) {
  return [
    {
      element: '[data-tour="stream-view-modes"]',
      popover: {
        title: t('View modes'),
        description: t('Cards, list, grids, or a calendar — the same posts in different shapes.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="stream-active-toggle"]',
      popover: {
        title: t('Hide completed posts'),
        description: t('Filters out requests and offers that are already fulfilled.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="stream-child-toggle"]',
      popover: {
        title: t('Posts from spaces'),
        description: t('Shows or hides posts from spaces and child groups you belong to.'),
        side: 'bottom'
      }
    },
    {
      element: '#sort-filter',
      popover: {
        title: t('Your choices stick'),
        description: t('Sort, view mode, and post type filters carry over to every stream on your account.'),
        side: 'bottom'
      }
    }
  ]
}
