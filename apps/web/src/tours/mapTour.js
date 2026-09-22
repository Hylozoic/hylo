export const MAP_TOUR_ID = 'map'

/** First visit to the map explorer. */
export function mapTourSteps (t) {
  return [
    {
      element: '[data-testid="drawer-toggle-button"]',
      popover: {
        title: t('The results drawer'),
        description: t('The list of everything on the map lives here, with a lens for posts, groups, and people.'),
        side: 'left'
      }
    },
    {
      element: '[data-tour="map-features"]',
      popover: {
        title: t('Choose what appears'),
        description: t('This is a filter: pick which kinds of things show up on the map.'),
        side: 'top'
      }
    },
    {
      element: '[data-testid="layers-selector-button"]',
      popover: {
        title: t('Map layers'),
        description: t('Switch base styles and overlays, including Native Territories.'),
        side: 'left'
      }
    },
    {
      element: '[data-tour="map-saved-searches"]',
      popover: {
        title: t('Save this view'),
        description: t('Saves the current map view as a search you can revisit any time.'),
        side: 'right'
      }
    }
  ]
}
