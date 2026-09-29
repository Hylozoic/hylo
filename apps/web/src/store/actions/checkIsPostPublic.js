import gql from 'graphql-tag'

export default function checkIsPostPublic (postId) {
  return {
    type: 'IS_POST_PUBLIC',
    graphql: {
      query: gql`
        query CheckIsPostPublic ($id: ID) {
          post (id: $id) {
            id
          }
        }
      `,
      variables: { id: postId }
    },
    meta: { extractModel: 'Post' }
  }
}

/**
 * For a signed-out visitor to a post they can't see: whether it exists and,
 * when one of its groups has a public About page, that group's name, slug and avatar.
 */
export function fetchPostTeaser (postId) {
  return {
    type: 'FETCH_POST_TEASER',
    graphql: {
      query: gql`
        query PostTeaser ($id: ID) {
          postTeaser (id: $id) {
            exists
            group {
              name
              slug
              avatarUrl
            }
          }
        }
      `,
      variables: { id: postId }
    }
  }
}
