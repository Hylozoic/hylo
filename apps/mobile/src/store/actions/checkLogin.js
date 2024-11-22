import { get } from 'lodash/fp'
import { CHECK_LOGIN } from 'store/constants'

const getRoot = get('me')

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
              digestFrequency
              dmNotifications
              commentNotifications
              locale
              signupInProgress
              streamChildPosts
              streamViewMode
              streamSortBy
              streamPostType
            }
          }
        }
      `
    },
    meta: {
      extractModel: [
        {
          getRoot,
          modelName: 'Me'
        }
      ]
    }
  }
}
