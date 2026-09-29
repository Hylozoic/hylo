import { AnalyticsEvents } from '@hylo/shared'
import {
  FETCH_JOIN_REQUESTS,
  FETCH_JOIN_REQUESTS_PENDING,
  ACCEPT_JOIN_REQUEST,
  DECLINE_JOIN_REQUEST
} from 'store/constants'
import fetchJoinRequestsQuery from '@graphql/queries/fetchJoinRequestsQuery'
export const MODULE_NAME = 'MembershipRequestsTab'

const defaultState = []

export default function reducer (state = defaultState, action) {
  const { error, type, payload } = action
  if (error) return state

  switch (type) {
    case FETCH_JOIN_REQUESTS_PENDING:
      return null
    case FETCH_JOIN_REQUESTS: {
      const requests = payload.data.joinRequests.items || []
      return requests.filter(r => r.status === 0)
    }
    case ACCEPT_JOIN_REQUEST: {
      const { acceptJoinRequest } = payload.data
      return (state || []).filter(item => item.id !== acceptJoinRequest.id)
    }
    case DECLINE_JOIN_REQUEST: {
      const { declineJoinRequest } = payload.data
      return (state || []).filter(item => item.id !== declineJoinRequest.id)
    }
    default:
      return state
  }
}

export function fetchJoinRequests (groupId) {
  return {
    type: FETCH_JOIN_REQUESTS,
    graphql: {
      query: fetchJoinRequestsQuery,
      variables: { groupId }
    },
    meta: {
      groupId
    }
  }
}

function hoursSince (createdAt) {
  if (!createdAt) return undefined
  return Math.round((Date.now() - new Date(createdAt).getTime()) / 360000) / 10
}

export function acceptJoinRequest (joinRequestId, groupId, requestCreatedAt) {
  return {
    type: ACCEPT_JOIN_REQUEST,
    graphql: {
      query: `mutation ($joinRequestId: ID) {
        acceptJoinRequest(joinRequestId: $joinRequestId) {
          id
        }
      }`,
      variables: { joinRequestId }
    },
    meta: {
      joinRequestId,
      groupId,
      optimistic: true,
      analytics: {
        eventName: AnalyticsEvents.JOIN_REQUEST_APPROVED,
        groupId,
        ageHours: hoursSince(requestCreatedAt)
      }
    }
  }
}

export function declineJoinRequest (joinRequestId, groupId, requestCreatedAt) {
  return {
    type: DECLINE_JOIN_REQUEST,
    graphql: {
      query: `mutation ($joinRequestId: ID) {
        declineJoinRequest(joinRequestId: $joinRequestId) {
          id
        }
      }`,
      variables: { joinRequestId }
    },
    meta: {
      joinRequestId,
      groupId,
      optimistic: true,
      analytics: {
        eventName: AnalyticsEvents.JOIN_REQUEST_DECLINED,
        groupId,
        ageHours: hoursSince(requestCreatedAt)
      }
    }
  }
}

// Blocking removed people from rejoining (D60)
export const FETCH_BLOCKED_FROM_REJOINING = `${MODULE_NAME}/FETCH_BLOCKED_FROM_REJOINING`
export const BAN_FROM_GROUP = `${MODULE_NAME}/BAN_FROM_GROUP`
export const LIFT_GROUP_BAN = `${MODULE_NAME}/LIFT_GROUP_BAN`

/** The people removed from a group and blocked from rejoining it, for its stewards. */
export function fetchBlockedFromRejoining (groupId) {
  return {
    type: FETCH_BLOCKED_FROM_REJOINING,
    graphql: {
      query: `query BlockedFromRejoining ($id: ID) {
        group(id: $id) {
          id
          blockedFromRejoining {
            id
            createdAt
            person {
              id
              name
              avatarUrl
            }
            createdBy {
              id
              name
            }
          }
        }
      }`,
      variables: { id: groupId }
    },
    meta: { groupId }
  }
}

/** Block someone already removed from a group from rejoining it. */
export function banFromGroup (personId, groupId) {
  return {
    type: BAN_FROM_GROUP,
    graphql: {
      query: `mutation BanFromGroup ($personId: ID, $groupId: ID) {
        banFromGroup(personId: $personId, groupId: $groupId) {
          success
        }
      }`,
      variables: { personId, groupId }
    },
    meta: { personId, groupId }
  }
}

/** Let someone blocked from rejoining a group come back through its usual routes. */
export function liftGroupBan (personId, groupId) {
  return {
    type: LIFT_GROUP_BAN,
    graphql: {
      query: `mutation LiftGroupBan ($personId: ID, $groupId: ID) {
        liftGroupBan(personId: $personId, groupId: $groupId) {
          success
        }
      }`,
      variables: { personId, groupId }
    },
    meta: { personId, groupId }
  }
}
