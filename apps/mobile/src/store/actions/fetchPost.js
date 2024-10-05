import { get } from 'lodash/fp'
import {
  FETCH_POST,
  FETCH_COMMENTS
} from 'store/constants'
import postQuery from 'graphql/queries/postQuery'

const getItems = get('payload.data.post.comments')
const getType = () => FETCH_COMMENTS

export default function fetchPost (id, query = postQuery) {
  return {
    type: FETCH_POST,
    graphql: {
      query,
      variables: {
        id
      }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'Post',
      extractQueryResults: {
        getType,
        getItems
      }
    }
  }
}
