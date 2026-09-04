import { get } from 'lodash/fp'
import { FETCH_FOR_CURRENT_USER } from 'store/constants'
import MeQuery from '@graphql/queries/MeQuery'

/**
 * Fetches the current user. Omits membership childGroups by default
 * (group nav stacking defaults to flat); pass includeChildGroups to override.
 */
export default function fetchForCurrentUser ({ includeChildGroups } = {}) {
  return {
    type: FETCH_FOR_CURRENT_USER,
    graphql: {
      query: MeQuery,
      variables: {
        includeChildGroups: includeChildGroups ?? false
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
