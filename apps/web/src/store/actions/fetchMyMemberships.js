import { get } from 'lodash/fp'
import { FETCH_MY_MEMBERSHIPS } from 'store/constants'

export default function fetchMyMemberships () {
  return {
    type: FETCH_MY_MEMBERSHIPS,
    graphql: {
      query: `
        query FetchMyMemberships {
          me {
            memberships {
              id
              lastViewedAt
              newPostCount
              person {
                id
              }
              settings {
                agreementsAcceptedAt
                digestFrequency
                joinQuestionsAnsweredAt
                postNotifications
                sendEmail
                sendPushNotifications
                showJoinForm
              }
              group {
                id
                avatarUrl
                bannerUrl
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
                    }
                  }
                }
                name
                memberCount
                stewardDescriptor
                stewardDescriptorPlural
                settings {
                  showSuggestedSkills
                }
                slug
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
