export const TRACK_SETUP_TOUR_ID = 'track-setup'

/** Offered when the Track type is selected in the space dialog. */
export function trackSetupTourSteps (t) {
  return [
    {
      element: '[data-tour="track-completion"]',
      popover: {
        title: t('Completion'),
        description: t('Shown to members when they finish the track — pair it with a badge or role they earn.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="track-unit-term"]',
      popover: {
        title: t('Name your actions'),
        description: t('The unit term renames everything members see. The actions themselves are authored later, as posts inside the track.'),
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
