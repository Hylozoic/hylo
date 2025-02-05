import { gql } from 'urql'

export default gql`
  fragment GroupContextWidgetsFieldsFragment on Group {
    contextWidgets {
      items {
        id
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
      }
    }
  }
`