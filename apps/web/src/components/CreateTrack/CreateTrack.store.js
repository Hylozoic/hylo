import { AnalyticsEvents } from '@hylo/shared'

export const MODULE_NAME = 'CreateTrack'
export const ADD_TRACK_NAME = `${MODULE_NAME}/ADD_TRACK_NAME`
export const CREATE_TRACK = `${MODULE_NAME}/CREATE_TRACK`

const defaultState = {}

export default function reducer (state = defaultState, action) {
  if (action.type === ADD_TRACK_NAME) {
    return { ...state, name: action.payload }
  }
  if (action.type === CREATE_TRACK) {
    if (!action.error) {
      return defaultState
    }
  }
  return state
}

export function addTrackName (name) {
  return {
    type: ADD_TRACK_NAME,
    payload: name
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
