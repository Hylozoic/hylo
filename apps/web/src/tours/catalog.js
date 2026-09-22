import { GLOBAL_CHROME_TOUR_ID, globalChromeTourSteps } from './globalChromeTour'
import { GROUP_CREATOR_TOUR_ID, GROUP_WELCOME_TOUR_ID, groupCreatorTourSteps, groupWelcomeTourSteps } from './groupTours'
import { MENU_EDIT_TOUR_ID, menuEditTourSteps } from './menuEditTour'
import { POST_EDITOR_TOUR_ID, postEditorTourSteps } from './postEditorTour'
import { MAP_TOUR_ID, mapTourSteps } from './mapTour'
import { STREAM_TOUR_ID, streamTourSteps } from './streamTour'
import { GROUP_SETTINGS_TOUR_ID, groupSettingsTourSteps } from './groupSettingsTour'
import { SPACE_CREATE_TOUR_ID, spaceCreateTourSteps } from './spaceCreateTour'
import { TRACK_SETUP_TOUR_ID, trackSetupTourSteps } from './trackSetupTour'
import { FUNDING_ROUND_SETUP_TOUR_ID, fundingRoundSetupTourSteps } from './fundingRoundSetupTour'
import { isAnchorVisible } from './useTour'

/**
 * Every tour in the app, for the Help menu's "Take a tour" list. A tour is
 * available when at least one of its anchors is actually visible on the
 * current surface — the same test the tours themselves start under.
 */
export function tourCatalog (t) {
  return [
    { id: GLOBAL_CHROME_TOUR_ID, title: t('Getting around Hylo'), steps: globalChromeTourSteps(t) },
    { id: GROUP_CREATOR_TOUR_ID, title: t('Set up your group'), steps: groupCreatorTourSteps(t) },
    { id: GROUP_WELCOME_TOUR_ID, title: t('Explore a group'), steps: groupWelcomeTourSteps(t) },
    { id: MENU_EDIT_TOUR_ID, title: t('Edit the menu'), steps: menuEditTourSteps(t) },
    { id: POST_EDITOR_TOUR_ID, title: t('Create a post'), steps: postEditorTourSteps(t) },
    { id: STREAM_TOUR_ID, title: t('The stream'), steps: streamTourSteps(t) },
    { id: MAP_TOUR_ID, title: t('The map'), steps: mapTourSteps(t) },
    { id: GROUP_SETTINGS_TOUR_ID, title: t('Group settings'), steps: groupSettingsTourSteps(t) },
    { id: SPACE_CREATE_TOUR_ID, title: t('Create a space'), steps: spaceCreateTourSteps(t) },
    { id: TRACK_SETUP_TOUR_ID, title: t('Set up a track'), steps: trackSetupTourSteps(t) },
    { id: FUNDING_ROUND_SETUP_TOUR_ID, title: t('Set up a funding round'), steps: fundingRoundSetupTourSteps(t) }
  ]
}

/** True when any of the tour's anchors is visible on the current surface. */
export function isTourAvailable (tour) {
  return tour.steps.some(step => step.element && isAnchorVisible(document.querySelector(step.element)))
}
