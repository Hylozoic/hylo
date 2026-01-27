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
            developerModeEnabled
            applications {
              id
              name
              description
              clientId
              scopes
              hasBot
              createdAt
            }
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
                chatRooms {
                  items {
                    id
                    groupTopic {
                      id
                      topic {
                        id
                        name
                      }
                    }
                    topicFollow {
                      id
                      settings {
                        notifications
                      }
                    }
                  }
                }
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
