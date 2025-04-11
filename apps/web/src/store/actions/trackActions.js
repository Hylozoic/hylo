import { AnalyticsEvents } from '@hylo/shared'

export const MODULE_NAME = 'Tracks'
export const CREATE_TRACK = `${MODULE_NAME}/CREATE_TRACK`
export const ENROLL_IN_TRACK = `${MODULE_NAME}/ENROLL_IN_TRACK`
export const ENROLL_IN_TRACK_PENDING = `${MODULE_NAME}/ENROLL_IN_TRACK_PENDING`
export const FETCH_TRACK = `${MODULE_NAME}/FETCH_TRACK`
export const LEAVE_TRACK = `${MODULE_NAME}/LEAVE_TRACK`
export const LEAVE_TRACK_PENDING = `${MODULE_NAME}/LEAVE_TRACK_PENDING`
export const UPDATE_TRACK = `${MODULE_NAME}/UPDATE_TRACK`
export const UPDATE_TRACK_PENDING = `${MODULE_NAME}/UPDATE_TRACK_PENDING`

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
            actionsName
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

export function createTrack (data) {
  return {
    type: CREATE_TRACK,
    graphql: {
      query: `mutation CreateTrack($data: TrackInput) {
        createTrack(data: $data) {
          id
          actionsName
          bannerUrl
          completionBadgeEmoji
          completionBadgeName
          completionMessage
          description
          groups {
            items {
              id
              name
              slug
            }
          }
          name
          publishedAt
          welcomeMessage
        }
      }
      `,
      variables: {
        data: {
          ...data,
          publishedAt: data.publishedAt ? data.publishedAt.valueOf() : null
        }
      }
    },
    meta: {
      extractModel: 'Track',
      ...data,
      analytics: AnalyticsEvents.TRACK_CREATED
    }
  }
}

export function updateTrack (data) {
  const { trackId, ...rest } = data
  return {
    type: UPDATE_TRACK,
    graphql: {
      query: `
        mutation ($trackId: ID, $data: TrackInput) {
          updateTrack(trackId: $trackId, data: $data) {
            id
          }
        }
      `,
      variables: {
        trackId,
        data: rest
      }
    },
    meta: {
      trackId,
      data: rest,
      optimistic: true
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
