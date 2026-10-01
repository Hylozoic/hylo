import { CHECK_LOGIN } from 'store/constants'
import MeQuery from '@graphql/queries/MeQuery'
import { meQueryExtractModel } from 'store/actions/fetchForCurrentUser'

/**
 * One GraphQL round trip: authSession reads CHECK_LOGIN (network-fresh); bootstrap/ORM
 * also receive FETCH_FOR_CURRENT_USER via checkLoginBootstrapFanOutMiddleware.
 */
export default function checkLoginAndBootstrap ({ includeChildGroups } = {}) {
  return {
    type: CHECK_LOGIN,
    graphql: {
      query: MeQuery,
      variables: {
        includeChildGroups: includeChildGroups ?? false
      }
    },
    meta: {
      extractModel: meQueryExtractModel,
      fanOutFetchForCurrentUser: true,
      fallbackToLightCheckLogin: true
    }
  }
}
