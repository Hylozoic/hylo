import { get } from 'lodash/fp'
import {
  FETCH_POST,
  FETCH_COMMENTS
} from 'store/constants'
import postQuery from '@graphql/queries/postQuery'

export default function fetchPost (id, withCompletionResponses = false) {
  return {
    type: FETCH_POST,
    graphql: {
      query: postQuery(withCompletionResponses),
      variables: {
        id
      }
    },
    meta: {
      extractModel: 'Post',
      extractQueryResults: {
        getType: () => FETCH_COMMENTS,
        getItems: get('payload.data.post.comments')
      }
    }
  }
}
