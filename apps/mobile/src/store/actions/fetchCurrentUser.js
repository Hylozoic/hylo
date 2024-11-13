import { FETCH_CURRENT_USER } from 'store/constants'
import meQuery from 'graphql/queries/meQuery'

export default function fetchCurrentUser () {
  return {
    type: FETCH_CURRENT_USER,
    graphql: {
      query: meQuery
    },
    meta: {
      extractModel: 'Me'
    }
  }
}
