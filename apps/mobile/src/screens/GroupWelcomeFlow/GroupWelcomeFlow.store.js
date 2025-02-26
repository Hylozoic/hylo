import isEmpty from 'lodash/isEmpty'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from '@hylo/presenters/GroupPresenter'

export const MODULE_NAME = 'GroupWelcomeFlow'
export const UPDATE_GROUP_DATA = `${MODULE_NAME}/UPDATE_GROUP_DATA`
export const CLEAR_GROUP_WELCOME_STORE = `${MODULE_NAME}/CLEAR_GROUP_WELCOME_STORE`
export const SET_WORKFLOW_OPTIONS = `${MODULE_NAME}/SET_WORKFLOW_OPTIONS`
export const INCREMENT_CURRENT_STEP_INDEX = `${MODULE_NAME}/INCREMENT_CURRENT_STEP_INDEX`
export const DECREMENT_CURRENT_STEP_INDEX = `${MODULE_NAME}/DECREMENT_CURRENT_STEP_INDEX`

export const GROUP_WELCOME_LANDING = 'Group Welcome'
export const GROUP_WELCOME_AGREEMENTS = 'Agreements'
export const GROUP_WELCOME_JOIN_QUESTIONS = 'Join Questions'
export const GROUP_WELCOME_SUGGESTED_SKILLS = 'Suggested Skills'

export const initialState = {
  // New Group Defaults
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

export default function reducer (state = initialState, action) {
  const { type, payload } = action
  switch (type) {
    case SET_WORKFLOW_OPTIONS:
      return {
        ...state,
        workflowOptions: payload
      }
    case INCREMENT_CURRENT_STEP_INDEX:
      return {
        ...state,
        currentStepIndex: state.currentStepIndex + 1
      }
    case DECREMENT_CURRENT_STEP_INDEX:
      return {
        ...state,
        currentStepIndex: (state.currentStepIndex === 0) ? 0 : state.currentStepIndex - 1
      }
    case UPDATE_GROUP_DATA:
      return {
        ...state,
        groupData: {
          ...state.groupData,
          ...payload
        },
        edited: true
      }
    case CLEAR_GROUP_WELCOME_STORE:
      return initialState
  }
  return state
}

export function setWorkflowOptions (value = {}) {
  return {
    type: SET_WORKFLOW_OPTIONS,
    payload: value
  }
}

export function incrementCurrentStepIndex () {
  return {
    type: INCREMENT_CURRENT_STEP_INDEX
  }
}

export function decrementCurrentStepIndex () {
  return {
    type: DECREMENT_CURRENT_STEP_INDEX
  }
}

export function updateGroupData (groupData) {
  return {
    type: UPDATE_GROUP_DATA,
    payload: groupData
  }
}

export function getGroupData (state) {
  return state[MODULE_NAME]?.groupData
}

export function getCurrentStepIndex (state) {
  return state[MODULE_NAME].currentStepIndex
}

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

export function getWorkflowOptions (state) {
  return state[MODULE_NAME].workflowOptions
}

export function clearWelcomeGroupStore () {
  return {
    type: CLEAR_GROUP_WELCOME_STORE
  }
}
