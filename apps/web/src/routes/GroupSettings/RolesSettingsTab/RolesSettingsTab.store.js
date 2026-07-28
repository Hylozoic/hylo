import {
  CLEAR_STEWARD_SUGGESTIONS,
  FETCH_STEWARD_SUGGESTIONS
} from 'store/constants'
import { createSelector } from 'reselect'
import orm from 'store/models'

export const MODULE_NAME = 'RolesSettingsTab'

const defaultState = []

export const getStewardSuggestions = createSelector(
  state => state.RoleSettings,
  state => state.orm,
  (personIds, ormState) => {
    const session = orm.session(ormState)
    return personIds.map(personId =>
      session.Person.idExists(personId) ? session.Person.withId(personId) : null
    ).filter(Boolean)
  }
)

export default function reducer (state = defaultState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case FETCH_STEWARD_SUGGESTIONS:
      return payload.data.group.members.items.map(m => m.id)
    case CLEAR_STEWARD_SUGGESTIONS:
      return []
    default:
      return state
  }
}

export function fetchStewardSuggestions (id, autocomplete) {
  return {
    type: FETCH_STEWARD_SUGGESTIONS,
    graphql: {
      query: `query ($id: ID, $autocomplete: String) {
        group (id: $id) {
          id
          members (first: 10, autocomplete: $autocomplete) {
            hasMore
            items {
              id
              name
              avatarUrl
            }
          }
        }
      }`,
      variables: {
        id, autocomplete
      }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}

export function clearStewardSuggestions () {
  return {
    type: CLEAR_STEWARD_SUGGESTIONS
  }
}
