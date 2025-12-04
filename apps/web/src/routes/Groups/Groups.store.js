const FETCH_RELATED_GROUPS = 'FETCH_RELATED_GROUPS'

export function fetchRelatedGroups (slug) {
  const query = `query FetchRelatedGroups ($slug: String) {
      group(slug: $slug) {
        id
        childGroups {
          items {
            id
            accessibility
            avatarUrl
            bannerUrl
            description
            geoShape
            name
            purpose
            settings {
              askJoinQuestions
            }
            slug
            visibility
            type
          }
        }
        parentGroups {
          items {
            id
            accessibility
            avatarUrl
            bannerUrl
            description
            geoShape
            name
            purpose
            settings {
              askJoinQuestions
            }
            slug
            visibility
            type
          }
        }
        peerGroups {
          items {
            id
            accessibility
            avatarUrl
            bannerUrl
            description
            geoShape
            name
            purpose
            settings {
              askJoinQuestions
            }
            slug
            visibility
            type
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
    type: FETCH_RELATED_GROUPS,
    graphql: { query, variables: { slug } },
    meta: {
      extractModel: 'Group',
      slug
    }
  }
}
