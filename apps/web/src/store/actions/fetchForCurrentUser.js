import { get } from 'lodash/fp'
import { getStackGroupsPreference } from 'contexts/ThemeContext'
import { FETCH_FOR_CURRENT_USER } from 'store/constants'
import MeQuery from '@graphql/queries/MeQuery'

/**
 * Fetches the current user. Includes membership childGroups only when
 * the stack-groups display preference is on (or when forced via options).
 */
export default function fetchForCurrentUser ({ includeChildGroups } = {}) {
  return {
    type: FETCH_FOR_CURRENT_USER,
    graphql: {
      query: MeQuery,
      variables: {
        includeChildGroups: includeChildGroups ?? getStackGroupsPreference()
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        }
      ]
    }
  }
}
