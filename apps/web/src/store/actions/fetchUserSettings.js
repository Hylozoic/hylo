import { get } from 'lodash/fp'
import { FETCH_USER_SETTINGS } from 'store/constants'

export default function fetchUserSettings () {
  return {
    type: FETCH_USER_SETTINGS,
    graphql: {
      query: `
        query UserSettingsQuery {
          me {
            id
            rsvpCalendarUrl
            affiliations {
              items {
                id
                role
                preposition
                orgName
                url
                createdAt
                updatedAt
                isActive
              }
            }
            blockedUsers {
              id
              name
            }
            memberships {
              id
              group {
                id
                name
              }
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
