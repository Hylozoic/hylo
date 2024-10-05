import { get } from 'lodash/fp'
import { AnalyticsEvents } from 'hylo-shared'
import { REGISTER } from 'store/constants'

export default function register (name, password) {
  return {
    type: REGISTER,
    graphql: {
      query: `
        mutation Register ($name: String!, $password: String!) {
          register(name: $name, password: $password) {
            me {
              id
              avatarUrl
              email
              emailValidated
              hasRegistered
              name
              settings {
                alreadySeenTour
                digestFrequency
                dmNotifications
                commentNotifications
                signupInProgress
                streamViewMode
                streamSortBy
                streamPostType
              }
            }
          }
        }
      `,
      variables: {
        name,
        password
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('register.me'),
          modelName: 'Me'
        }
      ],
      analytics: {
        eventName: AnalyticsEvents.SIGNUP_REGISTERED
      }
    }
  }
}
