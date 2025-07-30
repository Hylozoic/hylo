import { get } from 'lodash/fp'
import { FETCH_GROUP_CHAT_ROOMS } from 'store/constants'

export default function fetchAllMyGroupsChatRooms () {
  return {
    type: FETCH_GROUP_CHAT_ROOMS,
    graphql: {
      query: `
        query FetchGroupChatRooms {
          me {
            memberships {
              id
              lastViewedAt
              group {
                id
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
                      lastReadPostId
                      newPostCount
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
