import { FETCH_GROUP_FOR_LANDING_PAGE } from 'store/constants'

export default function fetchGroupForLandingPage ({ slug }) {
  return {
    type: FETCH_GROUP_FOR_LANDING_PAGE,
    graphql: {
      query: `
      query GroupLandingPageQuery ($slug: String) {
        group(slug: $slug) {
          id
          activeProjects: posts(filter: "project", sortBy: "updated", order: "desc", first: 4) {
            items {
              id
              title
              createdAt
              updatedAt
              creator {
                id
                name
              }
              members {
                items {
                  id
                  avatarUrl
                  name
                }
              }
            }
          }
          announcements: posts(isAnnouncement: true, sortBy: "created", order: "desc", first: 3) {
            hasMore
            items {
              id
              title
              createdAt
              creator {
                id
                name
              }
              attachments(type: "image") {
                position
                url
              }
            }
          }
          openOffersAndRequests: posts(types: ["offer", "request"], isFulfilled: false, first: 4) {
            items {
              id
              title
              type
              creator {
                id
                name
                avatarUrl
              }
              commentsTotal
            }
          }
          upcomingEvents: posts(afterTime: "${new Date().toISOString()}", filter: "event", sortBy: "start_time", order: "asc", first: 4) {
            hasMore
            items {
              id
              title
              startTime
              endTime
              location
              members {
                items {
                  id
                  avatarUrl
                  name
                }
              }
            }
          }
          widgets {
            items {
              id
              name
              isVisible
              order
              context
              settings {
                text
                title
              }
              group {
                id
              }
            }
          }
        }
      }`,
      variables: { slug }
    },
    meta: {
      extractModel: 'Group',
      slug
    }
  }
}
