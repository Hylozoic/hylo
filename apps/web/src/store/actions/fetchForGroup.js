import { get } from 'lodash/fp'
import { FETCH_FOR_GROUP } from 'store/constants'
import groupQueryFragment from '@graphql/fragments/groupQueryFragment'

export default function fetchForGroup (slug) {
  const query = `query FetchForGroup ($slug: String, $updateLastViewed: Boolean) {
      ${groupQueryFragment()}
    }`

  return {
    type: FETCH_FOR_GROUP,
    graphql: { query, variables: { slug, updateLastViewed: true } },
    meta: {
      extractModel: [
        {
          getRoot: get('group'),
          modelName: 'Group',
          append: true
        }
      ],
      slug
    }
  }
}
