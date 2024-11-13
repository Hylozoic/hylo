import { get } from 'lodash/fp'
import messageThreadsQuery from 'graphql/queries/messageThreadsQuery'
import { FETCH_THREADS } from 'store/constants'

export default function (first = 10, offset = 0) {
  return {
    type: FETCH_THREADS,
    graphql: {
      query: messageThreadsQuery,
      variables: {
        first,
        offset
      }
    },
    meta: {
      extractModel: 'Me',
      extractQueryResults: {
        getItems: get('payload.data.me.messageThreads')
      }
    }
  }
}
