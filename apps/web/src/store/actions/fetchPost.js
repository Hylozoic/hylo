import { get } from 'lodash/fp'
import {
  FETCH_POST,
  FETCH_COMMENTS
} from 'store/constants'
import postQuery from '@graphql/queries/postQuery'

/**
 * Fetch a post by id.
 * @param {string|number} id
 * @param {{ withComments?: boolean, withCompletion?: boolean, withCompletionResponses?: boolean }} [options]
 *   withComments — include comments + commenter identities (false for anonymous public viewers)
 *   withCompletion — include completedAt / completionAction / completionResponse (action posts)
 *   withCompletionResponses — include all members' completionResponses (managers)
 */
export default function fetchPost (id, {
  withComments = true,
  withCompletion = false,
  withCompletionResponses = false
} = {}) {
  return {
    type: FETCH_POST,
    graphql: {
      query: postQuery({ withComments, withCompletion, withCompletionResponses }),
      variables: {
        id
      }
    },
    meta: {
      extractModel: 'Post',
      // Only wire comment extraction when comments were requested
      ...(withComments
        ? {
            extractQueryResults: {
              getType: () => FETCH_COMMENTS,
              getItems: get('payload.data.post.comments')
            }
          }
        : {})
    }
  }
}
