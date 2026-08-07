import { get } from 'lodash/fp'
import { FETCH_FOR_CURRENT_USER } from 'store/constants'
import MeQuery from '@graphql/queries/MeQuery'

/** Shared ORM extract config for MeQuery (`checkLogin` + `fetchForCurrentUser`). */
export const meQueryExtractModel = [
  {
    getRoot: get('me'),
    modelName: 'Me'
  }
]

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
      extractModel: meQueryExtractModel
    }
  }
}
