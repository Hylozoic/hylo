export const FUNDING_ROUND_SETUP_TOUR_ID = 'funding-round-setup'

/** Offered when the Funding Round type is selected in the space dialog. */
export function fundingRoundSetupTourSteps (t) {
  return [
    {
      element: '[data-tour="round-schedule"]',
      popover: {
        title: t('Four dates drive the phases'),
        description: t('Submissions and voting open and close on these dates — you can also advance phases manually from Manage Round.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="round-voting"]',
      popover: {
        title: t('Tokens are the votes'),
        description: t("Choose how tokens are allocated, how many exist, and what they're called."),
        side: 'top'
      }
    },
    {
      element: '[data-tour="round-roles"]',
      popover: {
        title: t('Who takes part'),
        description: t('Limit who can submit and who can vote by role — leave empty to allow any member.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="space-publish"]',
      popover: {
        title: t('Draft or publish'),
        description: t('Save as Draft keeps it hidden in More Spaces until you publish; Create and Publish makes it live for members right away.'),
        side: 'top'
      }
    }
  ]
}
