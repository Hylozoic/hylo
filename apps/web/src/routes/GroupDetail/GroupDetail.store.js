import { AnalyticsEvents } from '@hylo/shared'
import { CREATE_JOIN_REQUEST, FETCH_MY_JOIN_REQUESTS } from 'store/constants'
import fetchMyPendingJoinRequestsQuery from '@graphql/queries/fetchMyPendingJoinRequestsQuery'

export const MODULE_NAME = 'GroupDetail'

export const JOIN_GROUP = `${MODULE_NAME}/JOIN_GROUP`
export const JOIN_GROUP_PENDING = `${MODULE_NAME}/JOIN_GROUP_PENDING`

export function fetchJoinRequests (groupId) {
  return {
    type: FETCH_MY_JOIN_REQUESTS,
    graphql: {
      query: fetchMyPendingJoinRequestsQuery
    },
    meta: {
      extractModel: 'Me'
    }
  }
}

/**
 * Join a group. For Restricted groups, pass accessCode or invitationToken for pre-approved join.
 * @param groupId {string} the group to join
 * @param questionAnswers {array} answers to join questions
 * @param accessCode {string} optional access code for pre-approved join
 * @param invitationToken {string} optional invitation token for pre-approved join
 * @param acceptAgreements {boolean} if true, record that user has accepted group agreements
 */
export function joinGroup (groupId, questionAnswers, accessCode, invitationToken, acceptAgreements) {
  return {
    type: JOIN_GROUP,
    graphql: {
      query: `mutation ($groupId: ID, $questionAnswers: [QuestionAnswerInput], $accessCode: String, $invitationToken: String, $acceptAgreements: Boolean) {
        joinGroup(groupId: $groupId, questionAnswers: $questionAnswers, accessCode: $accessCode, invitationToken: $invitationToken, acceptAgreements: $acceptAgreements) {
          id
          group {
            id
            name
            slug
          }
          person {
            id
          }
          lastViewedAt
          settings {
            agreementsAcceptedAt
            joinQuestionsAnsweredAt
            showJoinForm
          }
        }
      }`,
      variables: {
        groupId,
        questionAnswers,
        accessCode,
        invitationToken,
        acceptAgreements
      }
    },
    meta: {
      extractModel: 'Membership',
      groupId,
      optimistic: true,
      ...(accessCode || invitationToken
        ? {
            analytics: {
              eventName: AnalyticsEvents.GROUP_INVITATION_ACCEPTED,
              groupId,
              method: invitationToken ? 'email' : 'link'
            }
          }
        : {})
    }
  }
}

/**
 * Ask to join a group whose stewards approve new people.
 * @param groupId {string} the group to join
 * @param questionAnswers {array} answers to join questions
 * @param invitationToken {string} optional token of the member invitation that led to this request, so stewards see who invited the person
 */
export function createJoinRequest (groupId, questionAnswers, invitationToken) {
  return {
    type: CREATE_JOIN_REQUEST,
    graphql: {
      query: `mutation CreateJoinRequest ($groupId: ID, $questionAnswers: [QuestionAnswerInput], $invitationToken: String) {
        createJoinRequest(groupId: $groupId, questionAnswers: $questionAnswers, invitationToken: $invitationToken) {
          request {
            id
            user {
              id
            }
            group {
              id
            }
            createdAt
            updatedAt
            status
          }
        }
      }`,
      variables: { groupId, questionAnswers, invitationToken }
    },
    meta: {
      groupId,
      optimistic: true,
      analytics: {
        eventName: AnalyticsEvents.JOIN_REQUEST_CREATED,
        groupId
      }
    }
  }
}
