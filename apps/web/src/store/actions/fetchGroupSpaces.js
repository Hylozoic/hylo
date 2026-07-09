import { FETCH_GROUP_SPACES } from 'store/constants'

/** Loads child spaces for a group (used by More Spaces). */
export default function fetchGroupSpaces (groupId) {
  return {
    type: FETCH_GROUP_SPACES,
    graphql: {
      query: `query FetchGroupSpaces ($groupId: ID) {
        group(id: $groupId) {
          id
          spaces {
            items {
              id
              name
              slug
              avatarUrl
              icon
              bannerUrl
              description
              active
              homeRoute
              groupViews {
                items {
                  id
                  type
                  name
                  order
                  icon
                  newPostCount
                  viewPost {
                    id
                    title
                  }
                  viewUser {
                    id
                    name
                    avatarUrl
                  }
                  linkedGroup {
                    id
                    name
                    avatarUrl
                    icon
                  }
                }
              }
              track {
                id
                name
                publishedAt
              }
              fundingRound {
                id
                title
                publishedAt
              }
            }
          }
        }
      }`,
      variables: { groupId }
    },
    meta: { extractModel: 'Group' }
  }
}
