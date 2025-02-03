import { gql } from 'urql'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'presenters/GroupPresenter'
import groupFieldsFragment from '@hylo/graphql/fragments/groupFieldsFragment'
import groupPrerequisiteGroupsFieldsFragment from '@hylo/graphql/fragments/groupPrerequisiteGroupsFieldsFragment'

export const MODULE_NAME = 'CreateGroupFlow'
export const UPDATE_GROUP_DATA = `${MODULE_NAME}/UPDATE_GROUP_DATA`
export const FETCH_URL_EXISTS = `${MODULE_NAME}/FETCH_URL_EXISTS`
export const CREATE_GROUP = `${MODULE_NAME}/CREATE_GROUP`
export const CLEAR_CREATE_GROUP_STORE = `${MODULE_NAME}/CLEAR_CREATE_GROUP_STORE`
export const FETCH_GROUP_EXISTS = `${MODULE_NAME}/FETCH_GROUP_EXISTS`
export const SET_WORKFLOW_OPTIONS = `${MODULE_NAME}/SET_WORKFLOW_OPTIONS`

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
  workflowOptions: {},
  urlExists: false,
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
    case UPDATE_GROUP_DATA:
      return {
        ...state,
        groupData: {
          ...state.groupData,
          ...payload
        },
        edited: true
      }
    case CLEAR_CREATE_GROUP_STORE:
      return initialState
    case FETCH_URL_EXISTS:
      return {
        ...state,
        urlExists: action.payload.data.groupExists.exists,
        edited: true
      }
  }
  return state
}

// TODO: URQL! - analytics
// AnalyticsEvents.GROUP_CREATED (see action to get metadata that is sent)
export const createGroupMutation = gql`
  mutation CreateGroupMutation ($data: GroupInput) {
    createGroup(data: $data) {
      ...GroupFieldsFragment
      ...GroupPrerequisiteGroupsFieldsFragment
      memberships {
        items {
          id
          hasModeratorRole
          person {
            id
          }
          settings {
            agreementsAcceptedAt
            joinQuestionsAnsweredAt
            sendEmail
            showJoinForm
            sendPushNotifications
          }
        }
      }
    }
  }
  ${groupFieldsFragment}
  ${groupPrerequisiteGroupsFieldsFragment}
`

export const groupExistsCheckQuery = gql`
  query GroupExistsCheckQuery ($slug: String) {
    groupExists (slug: $slug) {
      exists
    }
  }
`

export function setWorkflowOptions (value = {}) {
  return {
    type: SET_WORKFLOW_OPTIONS,
    payload: value
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

export function getGroupUrlExists (state) {
  return state[MODULE_NAME].urlExists
}

export function getWorkflowOptions (state) {
  return state[MODULE_NAME].workflowOptions
}

export function getEdited (state) {
  return state[MODULE_NAME]?.edited
}

export function clearCreateGroupStore () {
  return {
    type: CLEAR_CREATE_GROUP_STORE
  }
}

// export const getNewGroupParentGroups = ormCreateSelector(
//   orm,
//   getGroupData,
//   (session, { parentIds }) => session.Group.all()
//     .toRefArray()
//     .filter(g => parentIds.includes(g.id))
//     .sort((a, b) => a.name.localeCompare(b.name))
// )
