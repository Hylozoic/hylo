export const FETCH_TRACK = 'FETCH_TRACK'
export const ENROLL_IN_TRACK = 'ENROLL_IN_TRACK'
export const ENROLL_IN_TRACK_PENDING = 'ENROLL_IN_TRACK_PENDING'
export const LEAVE_TRACK = 'LEAVE_TRACK'
export const LEAVE_TRACK_PENDING = 'LEAVE_TRACK_PENDING'

const CommentFieldsFragment = `
  id
  text
  creator {
    id
    name
    avatarUrl
  }
  attachments {
    id
    position
    type
    url
  }
  parentComment {
    id
  }
  myReactions {
    emojiFull
    id
  }
  commentReactions {
    emojiFull
    id
    user {
      id
      name
    }
  }
  createdAt
  editedAt
`

const PostFieldsFragment = `
  id
  title
  details
  type
  createdAt
  updatedAt
  startTime
  endTime
  timezone
  commentersTotal
  commentsTotal
  comments(first: 10, order: "desc") {
    items {
      ${CommentFieldsFragment}
      childComments(first: 3, order: "desc") {
        items {
          ${CommentFieldsFragment}
          post {
            id
          }
        }
        total
        hasMore
      }
    }
    total
    hasMore
  }
  completedAt
  completionAction
  completionActionSettings
  completionResponse
  linkPreview {
    description
    id
    imageUrl
    title
    url
  }
  linkPreviewFeatured
  location
  locationObject {
    id
    addressNumber
    addressStreet
    bbox {
      lat
      lng
    }
    center {
      lat
      lng
    }
    city
    country
    fullText
    locality
    neighborhood
    region
  }
  peopleReactedTotal
  myReactions {
    emojiFull
    id
  }
  postReactions {
    emojiFull
    id
    user {
      id
      name
    }
  }
  attachments {
    type
    url
    position
    id
  }
  topics {
    id
    name
  }
  members {
    total
    hasMore
    items {
      id
      name
      avatarUrl
      bio
      tagline
      location
    }
  }
`

export function fetchTrack (trackId) {
  return {
    type: FETCH_TRACK,
    graphql: {
      query: `
        query (
          $id: ID,
        ) {
          track (id: $id) {
            id
            bannerUrl
            completionBadgeEmoji
            completionBadgeName
            completionMessage
            description
            didComplete
            isEnrolled
            name
            numActions
            numPeopleCompleted
            numPeopleEnrolled
            publishedAt
            userSettings
            welcomeMessage
            posts {
              items {
                ${PostFieldsFragment}
              }
            }
          }
        }
      `,
      variables: {
        id: trackId
      }
    },
    meta: {
      extractModel: 'Track'
    }
  }
}

export function enrollInTrack (trackId) {
  return {
    type: ENROLL_IN_TRACK,
    graphql: {
      query: `
        mutation ($trackId: ID) {
          enrollInTrack(trackId: $trackId) {
            success
          }
        }
      `,
      variables: {
        trackId
      }
    },
    meta: {
      trackId
    }
  }
}

export function leaveTrack (trackId) {
  return {
    type: LEAVE_TRACK,
    graphql: {
      query: `
        mutation ($trackId: ID) {
          leaveTrack(trackId: $trackId) {
            success
          }
        }
      `,
      variables: {
        trackId
      }
    },
    meta: {
      trackId
    }
  }
}
