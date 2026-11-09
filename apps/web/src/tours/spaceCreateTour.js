export const SPACE_CREATE_TOUR_ID = 'space-create'

/** First open of the create-a-space dialog: what each type is, then the
 * form's load-bearing choices. */
export function spaceCreateTourSteps (t) {
  return [
    {
      element: '[data-tour="space-type-custom"]',
      popover: {
        title: t('Custom Space'),
        description: t('Spaces are places inside a group where people can gather, share information, and coordinate. Custom spaces can be shaped for any kind of coordination.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="space-type-chat"]',
      popover: {
        title: t('Chat Space'),
        description: t('A simple chat space to gather and chat.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="space-type-track"]',
      popover: {
        title: t('Track'),
        description: t('A guided series of actions for members to work through, with an optional badge or role awarded on completion.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="space-type-funding-round"]',
      popover: {
        title: t('Funding Round'),
        description: t('Members submit proposals and allocate votes to decide together what gets support.'),
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
