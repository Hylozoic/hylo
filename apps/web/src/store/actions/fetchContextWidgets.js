import { FETCH_CONTEXT_WIDGETS } from 'store/constants'

export default function fetchContextWidgets (groupId) {
  return {
    type: FETCH_CONTEXT_WIDGETS,
    graphql: {
      query: `query FetchContextWidgets ($groupId: ID) {
        group(id: $groupId) {
          id
          contextWidgets {
            items {
              id
              autoAdded
              title
              type
              order
              visibility
              view
              icon
              highlightNumber
              secondaryNumber
              parentId
              viewGroup {
                id
                avatarUrl
                bannerUrl
                name
                memberCount
                visibility
                accessibility
                slug
              }
              viewPost {
                id
                announcement
                title
                details
                type
                createdAt
                startTime
                endTime
                isPublic
              }
              customView {
                id
                groupId
                collectionId
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
              viewUser {
                id
                name
                avatarUrl
              }
              viewChat {
                id
                name
              }
              viewTrack {
                id
                name
                didComplete
                isEnrolled
                numActions
              }
            }
          }
        }
      }`,
      variables: {
        groupId
      }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}
