import { get } from 'lodash/fp'
import { AnalyticsEvents } from 'hylo-shared'
import { VERIFY_EMAIL } from 'store/constants'

export default function verifyEmail (email, code, token) {
  return {
    type: VERIFY_EMAIL,
    graphql: {
      query: `
        mutation ($email: String!, $code: String, $token: String) {
          verifyEmail(email: $email, code: $code, token: $token) {
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
            error
          }
        }
      `,
      variables: {
        email,
        code,
        token
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('verifyEmail.me'),
          modelName: 'Me'
        }
      ],
      analytics: {
        eventName: AnalyticsEvents.SIGNUP_EMAIL_VERIFIED,
        email
      }
    }
  }
}
