import { FETCH_CUSTOM_VIEW } from 'store/constants'

/**
 * Loads a single CustomView into the ORM for stream routes (sort, view mode, topics, etc.).
 */
export default function fetchCustomView (id) {
  return {
    type: FETCH_CUSTOM_VIEW,
    graphql: {
      query: `query FetchCustomView ($id: ID) {
        customView(id: $id) {
          id
          groupId
          activePostsOnly
          collectionId
          defaultSort
          defaultViewMode
          externalLink
          isActive
          icon
          name
          order
          postTypes
          topics {
            id
            name
          }
          type
        }
      }`,
      variables: { id }
    },
    meta: {
      extractModel: 'CustomView'
    }
  }
}
