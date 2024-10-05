import { get } from 'lodash/fp'
import { AnalyticsEvents } from 'hylo-shared'
import { SEND_EMAIL_VERIFICATION } from 'store/constants'

export default function sendEmailVerification (email) {
  return {
    type: SEND_EMAIL_VERIFICATION,
    graphql: {
      query: `
        mutation SendEmailVerification ($email: String!) {
          sendEmailVerification(email: $email) {
            success
            error
          }
        }
      `,
      variables: {
        email
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('sendEmailVerification.me'),
          modelName: 'Me'
        }
      ],
      analytics: {
        eventName: AnalyticsEvents.SIGNUP_EMAIL_VERIFICATION_SENT,
        email
      }
    }
  }
}
