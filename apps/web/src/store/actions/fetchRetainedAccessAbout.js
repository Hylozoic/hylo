export default function fetchRetainedAccessAbout (slug) {
  return {
    type: 'RetainedAccessAbout/FETCH',
    graphql: {
      query: `query RetainedAccessAbout ($slug: String!) {
        retainedAccessAbout(slug: $slug) {
          id
          name
          slug
          type
          description
          purpose
          avatarUrl
          bannerUrl
          homeRoute
          hasActiveParentMembership
          parentGroupName
          parentGroupSlug
        }
      }`,
      variables: { slug }
    }
  }
}
