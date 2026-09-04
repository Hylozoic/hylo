import { get } from 'lodash/fp'
import {
  FETCH_POST,
  FETCH_COMMENTS
} from 'store/constants'
import postQuery from '@graphql/queries/postQuery'

/**
 * Fetch a post by id.
 * @param {string|number} id
 * @param {{ withCompletion?: boolean, withCompletionResponses?: boolean }} [options]
 *   withCompletion — include completedAt / completionAction / completionResponse (action posts)
 *   withCompletionResponses — include all members' completionResponses (managers)
 */
export default function fetchPost (id, { withCompletion = false, withCompletionResponses = false } = {}) {
  return {
    type: FETCH_POST,
    graphql: {
      query: postQuery({ withCompletion, withCompletionResponses }),
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
