import { get } from 'lodash/fp'
import MessageThreadsQuery from '@graphql/queries/MessageThreadsQuery'
import { FETCH_THREADS } from 'store/constants'

export default function (first = 10, offset = 0, { muted = false, search } = {}) {
  const variables = { first, offset, muted }
  if (search) variables.search = search

  return {
    type: FETCH_THREADS,
    graphql: {
      query: MessageThreadsQuery,
      variables
    },
    meta: {
      extractModel: 'Me',
      extractQueryResults: {
        getItems: get('payload.data.me.messageThreads'),
        getRouteParams: action => {
          const params = { muted: action.graphql.variables.muted || false }
          if (action.graphql.variables.search) {
            params.search = action.graphql.variables.search
          }
          return params
        }
      }
    }
  }
}
