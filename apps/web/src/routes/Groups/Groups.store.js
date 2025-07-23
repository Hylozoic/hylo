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
            slug
            visibility
            type
          }
        }
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
            slug
            visibility
            type
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
