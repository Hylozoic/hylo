import { get } from 'lodash/fp'
import { CHECK_LOGIN } from 'store/constants'

export default function checkLogin () {
  return {
    type: CHECK_LOGIN,
    graphql: {
      query: `
        query CheckLogin {
          me {
            id
            avatarUrl
            email
            emailValidated
            hasRegistered
            name
            settings {
              alreadySeenTour
              colorScheme
              dmNotifications
              commentNotifications
              globalNavStyle
              groupNavStyle
              rsvpCalendarSub
              signupInProgress
              stackGroups
              independentSpaceMenu
              streamChildPosts
              streamViewMode
              streamSortBy
              streamPostType
              theme
            }
          }
        }
      `
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        }
      ]
    }
  }
}
