import { FETCH_CURRENT_USER } from 'store/constants'
import MeQuery from 'graphql/queries/MeQuery'

export default function fetchCurrentUser () {
  return {
    type: FETCH_CURRENT_USER,
    graphql: {
      query: MeQuery
    },
    meta: {
      extractModel: 'Me'
    }
  }
}
