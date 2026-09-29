import { get } from 'lodash/fp'
import { AnalyticsEvents } from '@hylo/shared'
import { acquisitionSourceInput } from 'util/acquisitionSource'

export const MODULE_NAME = 'Signup'
export const REGISTER = `${MODULE_NAME}/REGISTER`
export const SEND_EMAIL_VERIFICATION = `${MODULE_NAME}/SEND_EMAIL_VERIFICATION`
export const VERIFY_EMAIL = `${MODULE_NAME}/VERIFY_EMAIL`
export const CHECK_REGISTRATION_STATUS = `${MODULE_NAME}/CHECK_REGISTRATION_STATUS`

// The first-touch source goes along so a new account keeps it (util/acquisitionSource)
export function sendEmailVerification (email, acquisitionSource = acquisitionSourceInput()) {
  return {
    type: SEND_EMAIL_VERIFICATION,
    graphql: {
      query: `
        mutation SendEmailVerification ($email: String!, $acquisitionSource: AcquisitionSourceInput) {
          sendEmailVerification(email: $email, acquisitionSource: $acquisitionSource) {
            success
            error
          }
        }
      `,
      variables: {
        email,
        acquisitionSource
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
        eventName: AnalyticsEvents.SIGNUP_EMAIL_VERIFICATION_SENT
      }
    }
  }
}

export function verifyEmail (email, code, token) {
  return {
    type: VERIFY_EMAIL,
    graphql: {
      query: `
        mutation ($email: String!, $code: String, $token: String) {
          verifyEmail(email: $email, code: $code, token: $token) {
            me {
              id
              email
              emailValidated
              hasRegistered
              name
              cookieConsentPreferences {
                id
                settings
                version
                updatedAt
              }
              settings {
                alreadySeenTour
                toursSeen
                colorScheme
                dmNotifications
                commentNotifications
                locale
                globalNavStyle
                groupNavStyle
                signupInProgress
                stackGroups
                streamChildPosts
                streamViewMode
                streamSortBy
                streamPostType
                theme
              }
            }
            error
          }
        }
      `,
      variables: {
        code,
        email,
        token
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('verifyEmail.me'),
          modelName: 'Me'
        }
      ]
    }
  }
}

export function register (name, password) {
  return {
    type: REGISTER,
    graphql: {
      query: `
        mutation Register ($name: String!, $password: String!) {
          register(name: $name, password: $password) {
            me {
              id
              email
              emailValidated
              hasRegistered
              name
              cookieConsentPreferences {
                id
                settings
                version
                updatedAt
              }
              settings {
                alreadySeenTour
                toursSeen
                colorScheme
                dmNotifications
                commentNotifications
                signupInProgress
                locale
                globalNavStyle
                groupNavStyle
                stackGroups
                streamChildPosts
                streamViewMode
                streamSortBy
                streamPostType
                theme
              }
            }
            error
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
      ]
    }
  }
}
