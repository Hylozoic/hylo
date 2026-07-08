import { FETCH_GROUP_VIEWS } from 'store/constants'

export default function fetchGroupViews (groupId) {
  return {
    type: FETCH_GROUP_VIEWS,
    graphql: {
      query: `query FetchGroupViews ($groupId: ID) {
        group(id: $groupId) {
          id
          groupViews {
            items {
              id
              type
              name
              order
              icon
              link
              pageContent
              topics
              settings
              newPostCount
              lastReadPostId
              linkedGroup {
                id
                name
                slug
                avatarUrl
                icon
                homeRoute
                description
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
              }
              viewPost {
                id
                title
              }
              viewUser {
                id
                name
                avatarUrl
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
