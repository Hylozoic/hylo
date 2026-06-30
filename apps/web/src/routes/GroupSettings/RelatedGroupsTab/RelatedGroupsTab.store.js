import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import { getCurrentlyRelatedGroupIds } from 'store/selectors/getGroupRelationships'
import getMyMemberships from 'store/selectors/getMyMemberships'

export const MODULE_NAME = 'RelatedGroups'

// Constants
export const SET_SEARCH = `${MODULE_NAME}/SET_SEARCH`
export const FETCH_GROUP_TO_GROUP_JOIN_QUESTIONS = `${MODULE_NAME}/FETCH_GROUP_TO_GROUP_JOIN_QUESTIONS`

export function fetchGroupToGroupJoinQuestions () {
  return {
    type: FETCH_GROUP_TO_GROUP_JOIN_QUESTIONS,
    graphql: {
      query: `query FetchGroupToGroupJoinQuestions {
        me {
          memberships {
            id
            group {
              id
              groupToGroupJoinQuestions {
                items {
                  id
                  questionId
                  text
                }
              }
            }
          }
        }
      }`
    },
    meta: {
      extractModel: 'Me'
    }
  }
}

// Reducer
const defaultState = {
  search: ''
}

export default function reducer (state = defaultState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case SET_SEARCH:
      return {
        ...state,
        search: payload
      }
    default:
      return state
  }
}

export function setSearch (search) {
  return {
    type: SET_SEARCH,
    payload: search
  }
}

// Selectors
export const moduleSelector = (state) => state[MODULE_NAME]

export const getPossibleRelatedGroups = ormCreateSelector(
  orm,
  (_, group) => group,
  (state, group) => getCurrentlyRelatedGroupIds(state, group),
  getMyMemberships,
  (state, group, currentRelationships, myMemberships) => {
    // TODO: check for cycles, cant add a grandparent as a child

    // XXX: can't call getResponsibilitiesForGroup here because it does weird things when passed in the stats straight from ORM 🤷‍♂️
    const me = state.Me.first()

    return myMemberships.filter(m => {
      if (m.group.id !== group.id && !currentRelationships.includes(m.group.id)) {
        const groupRolesForGroup = (me.groupRoles?.items || []).filter(role => role.groupId === m.group.id)
        const responsibilities = groupRolesForGroup.flatMap(role => role.responsibilities?.items || [])

        m.hasAdministrationAbility = responsibilities.some(r => r.title === 'Administration')
        return true
      }
      return false
    }).sort((a, b) => a.group.name.localeCompare(b.group.name))
  }
)
