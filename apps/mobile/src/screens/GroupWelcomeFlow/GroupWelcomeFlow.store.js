import { create } from 'zustand'
import isEmpty from 'lodash/isEmpty'

export const useGroupWelcomeStore = create((set, get) => ({
  currentStepIndex: 0,
  incrementCurrentStepIndex: () => set((state) => ({
    currentStepIndex: state.currentStepIndex + 1
  })),
  decrementCurrentStepIndex: () => set((state) => ({
    currentStepIndex: state.currentStepIndex === 0 ? 0 : state.currentStepIndex - 1
  }))
}))

export const GROUP_WELCOME_LANDING = 'Group Welcome'
export const GROUP_WELCOME_AGREEMENTS = 'Agreements'
export const GROUP_WELCOME_JOIN_QUESTIONS = 'Join Questions'
export const GROUP_WELCOME_SUGGESTED_SKILLS = 'Suggested Skills'

export function getRouteNames (group, currentMembership) {
  const routeNames = [GROUP_WELCOME_LANDING]
  const { agreements, settings } = group
  // TODO redesign: have run into instances of group being null here, so need to guard against that...
  if (!isEmpty(agreements?.items)) {
    routeNames.push(GROUP_WELCOME_AGREEMENTS)
  }
  if (
    settings?.askJoinQuestions &&
    !isEmpty(group?.joinQuestions?.items) &&
    !currentMembership?.settings?.joinQuestionsAnsweredAt
  ) {
    routeNames.push(GROUP_WELCOME_JOIN_QUESTIONS)
  }
  if (
    !isEmpty(group?.suggestedSkills?.items) &&
    group?.settings?.showSuggestedSkills
  ) {
    routeNames.push(GROUP_WELCOME_SUGGESTED_SKILLS)
  }
  return routeNames
}
