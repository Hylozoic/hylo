import { AnalyticsEvents } from '@hylo/shared'
import CommentFieldsFragment from '@graphql/fragments/CommentFieldsFragment'

export const MODULE_NAME = 'Tracks'
export const CREATE_TRACK = `${MODULE_NAME}/CREATE_TRACK`
export const DUPLICATE_TRACK = `${MODULE_NAME}/DUPLICATE_TRACK`
export const ENROLL_IN_TRACK = `${MODULE_NAME}/ENROLL_IN_TRACK`
export const ENROLL_IN_TRACK_PENDING = `${MODULE_NAME}/ENROLL_IN_TRACK_PENDING`
export const FETCH_TRACK = `${MODULE_NAME}/FETCH_TRACK`
export const LEAVE_TRACK = `${MODULE_NAME}/LEAVE_TRACK`
export const LEAVE_TRACK_PENDING = `${MODULE_NAME}/LEAVE_TRACK_PENDING`
export const UPDATE_TRACK = `${MODULE_NAME}/UPDATE_TRACK`
export const UPDATE_TRACK_PENDING = `${MODULE_NAME}/UPDATE_TRACK_PENDING`
export const FETCH_TRACK_SUGGESTIONS = `${MODULE_NAME}/FETCH_TRACK_SUGGESTIONS`
export const FETCH_MY_TRACK_PROGRESS = `${MODULE_NAME}/FETCH_MY_TRACK_PROGRESS`

export const PostFieldsFragment = `
  id
  commentersTotal
  commentsTotal
  completedAt
  completionAction
  completionActionSettings
  completionResponse
  createdAt
  details
  endTime
  linkPreviewFeatured
  location
  numPeopleCompleted
  peopleReactedTotal
  startTime
  timezone
  title
  type
  updatedAt
  attachments {
    type
    url
    position
    id
  }
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
  completionResponses {
    items {
      id
      completedAt
      completionResponse
      user {
        id
        name
        avatarUrl
      }
    }
  }
  groups {
    id
    name
    slug
  }
  linkPreview {
    description
    id
    imageUrl
    title
    url
  }
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
  postReactions {
    emojiFull
    id
    user {
      id
      name
    }
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
            accessControlled
            canAccess
            actionDescriptor
            actionDescriptorPlural
            completionMessage
            completionRole {
              id
              emoji
              name
              groupId
              responsibilities {
                items {
                  id
                  title
                  description
                }
              }
            }
            didComplete
            space {
              id
              slug
              type
              status
              homeRoute
              name
              bannerUrl
              description
              parentGroup {
                id
                slug
              }
            }
            enrolledUsers {
              items {
                id
                avatarUrl
                completedAt
                enrolledAt
                name
              }
            }
            isEnrolled
            numActions
            numPeopleCompleted
            numPeopleEnrolled
            userSettings
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
  // We need completionRole in the data for the optimistic update, but only the id in the mutation
  data = { ...data, completionRoleId: data.completionRole?.id }
  delete data.completionRole

  return {
    type: CREATE_TRACK,
    graphql: {
      query: `mutation CreateTrack($data: TrackInput) {
        createTrack(data: $data) {
          id
          actionDescriptor
          actionDescriptorPlural
          completionMessage
          completionRole {
            id
            emoji
            name
          }
          space {
            id
            slug
            type
            status
            homeRoute
            name
            bannerUrl
            description
            parentGroup {
              id
              slug
            }
          }
        }
      }
      `,
      variables: {
        data
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

  // We need completionRole in the data for the optimistic update, but only the id in the mutation
  const dataForUpdate = { ...rest }
  if (Object.prototype.hasOwnProperty.call(rest, 'completionRole')) {
    dataForUpdate.completionRoleId = rest.completionRole?.id ?? null
  }
  delete dataForUpdate.completionRole

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
        data: dataForUpdate
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
            id
            isEnrolled
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
            id
            isEnrolled
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

export function duplicateTrack (trackId) {
  return {
    type: DUPLICATE_TRACK,
    graphql: {
      query: `
        mutation ($trackId: ID) {
          duplicateTrack(trackId: $trackId) {
            id
            space {
              id
              slug
              type
              status
              homeRoute
              parentGroup {
                id
                slug
              }
            }
          }
        }
      `,
      variables: {
        trackId
      }
    },
    meta: {
      extractModel: 'Track'
    }
  }
}

/**
 * The parent group's other track spaces, for the suggestions on a track's completion
 * screen (D33). Read from the response; nothing is added to the store.
 */
export function fetchTrackSuggestions (groupId) {
  return {
    type: FETCH_TRACK_SUGGESTIONS,
    graphql: {
      query: `
        query FetchTrackSuggestions ($groupId: ID) {
          group(id: $groupId) {
            id
            slug
            spaces {
              items {
                id
                name
                slug
                status
                active
                avatarUrl
                track {
                  id
                  isEnrolled
                  didComplete
                  numActions
                }
              }
            }
          }
        }
      `,
      variables: { groupId }
    },
    meta: { groupId }
  }
}

/**
 * The current user's progress in each track space they belong to, for the My Tracks
 * cards (D33): the track's action count and their membership settings, which record
 * actionsCompleted. Read from the response; nothing is added to the store.
 */
export function fetchMyTrackProgress () {
  return {
    type: FETCH_MY_TRACK_PROGRESS,
    graphql: {
      query: `
        query FetchMyTrackProgress {
          me {
            id
            memberships {
              id
              group {
                id
                track {
                  id
                  numActions
                  didComplete
                  userSettings
                }
              }
            }
          }
        }
      `
    }
  }
}
