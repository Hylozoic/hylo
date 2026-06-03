import { get } from 'lodash/fp'
import { FETCH_GROUP_RELATIONSHIPS } from 'store/constants'

export default function fetchGroupRelationships (slug) {
  const query = `query FetchGroupRelationships ($slug: String) {
    group(slug: $slug, updateLastViewed: false) {
      id
      parentGroups {
        items {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
      }
      childGroups {
        items {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
      }
      peerGroups {
        items {
          id
          name
          avatarUrl
          bannerUrl
          memberCount
          visibility
          accessibility
          slug
        }
      }
      peerGroupRelationships {
        items {
          id
          description
          relationshipType
          parentGroup {
            id
            slug
            name
          }
          childGroup {
            id
            slug
            name
          }
        }
      }
    }
  }`

  return {
    type: FETCH_GROUP_RELATIONSHIPS,
    graphql: { query, variables: { slug } },
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
