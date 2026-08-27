export const SPACE_CREATE_TOUR_ID = 'space-create'

/** First open of the create-a-space dialog. */
export function spaceCreateTourSteps (t) {
  return [
    {
      element: '[data-tour="space-type"]',
      popover: {
        title: t('Pick the type carefully'),
        description: t('This choice is permanent. Tracks and funding rounds are spaces with extra machinery built in.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="space-access"]',
      popover: {
        title: t('Access is enrollment'),
        description: t('A space has its own members — whoever can join is whoever can take part.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="space-home"]',
      popover: {
        title: t('The home view'),
        description: t("The first thing members see when they enter. Reorder the space's menu any time to change it."),
        side: 'top'
      }
    }
  ]
}
