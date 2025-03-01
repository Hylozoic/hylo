import { create } from 'zustand'
import isEmpty from 'lodash/isEmpty'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from '@hylo/presenters/GroupPresenter'

// Constants
export const GROUP_WELCOME_LANDING = 'Group Welcome'
export const GROUP_WELCOME_AGREEMENTS = 'Agreements'
export const GROUP_WELCOME_JOIN_QUESTIONS = 'Join Questions'
export const GROUP_WELCOME_SUGGESTED_SKILLS = 'Suggested Skills'

// Initial State
const initialState = {
  groupData: {
    name: '',
    slug: '',
    purpose: '',
    visibility: GROUP_VISIBILITY.Protected,
    accessibility: GROUP_ACCESSIBILITY.Restricted,
    parentIds: []
  },
  currentStepIndex: 0,
  workflowOptions: { disableContinue: false },
  edited: false
}

export const useGroupWelcomeStore = create((set, get) => ({
  ...initialState,

  // Actions
  setWorkflowOptions: (value = {}) => set({ workflowOptions: value }),

  incrementCurrentStepIndex: () => set((state) => ({
    currentStepIndex: state.currentStepIndex + 1
  })),

  decrementCurrentStepIndex: () => set((state) => ({
    currentStepIndex: state.currentStepIndex === 0 ? 0 : state.currentStepIndex - 1
  })),

  updateGroupData: (groupData) => set((state) => ({
    groupData: { ...state.groupData, ...groupData },
    edited: true
  })),

  clearWelcomeGroupStore: () => set(initialState),

  // Selectors (optional but useful for API consistency)
  getGroupData: () => get().groupData,
  getCurrentStepIndex: () => get().currentStepIndex,
  getWorkflowOptions: () => get().workflowOptions
}))

// ✅ Route Name Generator (kept as a function, not part of store)
export function getRouteNames (group, currentMembership) {
  const routeNames = [GROUP_WELCOME_LANDING]
  const { agreements, settings } = group
  // TODO redesign: have run into instances of group being null here, so need to guard against that...
  if (!isEmpty(agreements?.items)) {
    routeNames.push(GROUP_WELCOME_AGREEMENTS)
  }
  if (
    settings.askJoinQuestions &&
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
