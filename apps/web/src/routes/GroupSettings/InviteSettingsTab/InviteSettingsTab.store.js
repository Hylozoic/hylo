import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export const MODULE_NAME = 'InviteSettingsTab'
export const CREATE_INVITATIONS = `${MODULE_NAME}/CREATE_INVITATIONS`
export const CREATE_INVITATIONS_PENDING = `${MODULE_NAME}/CREATE_INVITATIONS_PENDING`
export const FETCH_PENDING_INVITATIONS = `${MODULE_NAME}/FETCH_PENDING_INVITATIONS`
export const FETCH_INVITEABLE_PEOPLE = `${MODULE_NAME}/FETCH_INVITEABLE_PEOPLE`

export const EXPIRE_INVITATION = `${MODULE_NAME}/EXPIRE_INVITATION`
export const EXPIRE_INVITATION_PENDING = `${MODULE_NAME}/EXPIRE_INVITATION_PENDING`

export const RESEND_INVITATION = `${MODULE_NAME}/RESEND_INVITATION`
export const RESEND_INVITATION_PENDING = `${MODULE_NAME}/RESEND_INVITATION_PENDING`

export const REINVITE_ALL = `${MODULE_NAME}/REINVITE_ALL`
export const REINVITE_ALL_PENDING = `${MODULE_NAME}/REINVITE_ALL_PENDING`

export const ALLOW_GROUP_INVITES = `${MODULE_NAME}/ALLOW_GROUP_INVITES`
export const DISALLOW_GROUP_INVITES = `${MODULE_NAME}/DISALLOW_GROUP_INVITES`

const defaultState = []

export default function reducer (state = defaultState, action) {
  const { error, type } = action
  if (error) return state

  switch (type) {
    default:
      return state
  }
}

export function createInvitations (groupId, emails, message, groupRoleId = null, userIds = []) {
  return {
    type: CREATE_INVITATIONS,
    graphql: {
      query: `mutation ($groupId: ID, $data: InviteInput) {
        createInvitation(groupId: $groupId, data: $data) {
          invitations {
            id,
            email,
            createdAt,
            lastSentAt,
            error
          }
        }
      }`,
      variables: {
        groupId,
        data: {
          emails,
          userIds,
          message,
          groupRoleId
        }
      }
    },
    meta: {
      groupId,
      emails,
      optimistic: true
    }
  }
}

/** Loads invitePath and pending invitations so the invite UI works outside Group Settings. */
export function fetchPendingInvitations (groupId) {
  return {
    type: FETCH_PENDING_INVITATIONS,
    graphql: {
      query: `query ($id: ID) {
        group (id: $id) {
          id
          invitePath
          pendingInvitations {
            hasMore
            items {
              id
              email
              name
              userId
              createdAt
              lastSentAt
            }
          }
        }
      }`,
      variables: { id: groupId }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}

export const INVITEABLE_PEOPLE_PAGE_SIZE = 15

/**
 * People who can be invited: connections not already in the group, or (for spaces)
 * parent-group members not already in the space. Loads one page at a time.
 */
export function fetchInviteablePeople ({
  groupId,
  parentGroupId,
  autocomplete = '',
  first = INVITEABLE_PEOPLE_PAGE_SIZE,
  offset = 0
}) {
  if (parentGroupId) {
    return {
      type: FETCH_INVITEABLE_PEOPLE,
      graphql: {
        query: `query ($parentGroupId: ID, $groupId: ID, $autocomplete: String, $first: Int, $offset: Int) {
          group (id: $parentGroupId) {
            id
            members (first: $first, offset: $offset, autocomplete: $autocomplete, sortBy: "name", order: "asc", excludeGroupId: $groupId) {
              hasMore
              items {
                id
                name
                avatarUrl
              }
            }
          }
        }`,
        variables: { parentGroupId, groupId, autocomplete, first, offset }
      }
    }
  }

  return {
    type: FETCH_INVITEABLE_PEOPLE,
    graphql: {
      query: `query ($groupId: ID, $autocomplete: String, $first: Int, $offset: Int) {
        connections (first: $first, offset: $offset, autocomplete: $autocomplete, excludeGroupId: $groupId) {
          hasMore
          items {
            id
            person {
              id
              name
              avatarUrl
            }
          }
        }
      }`,
      variables: { groupId, autocomplete, first, offset }
    }
  }
}

export function reinviteAll (groupId) {
  return {
    type: REINVITE_ALL,
    graphql: {
      query: `mutation ($groupId: ID) {
        reinviteAll(groupId: $groupId) {
          success
        }
      }`,
      variables: {
        groupId
      }
    },
    meta: {
      groupId,
      optimistic: true
    }
  }
}

export function expireInvitation (invitationToken) {
  return {
    type: EXPIRE_INVITATION,
    graphql: {
      query: `mutation ($invitationToken: ID) {
        expireInvitation(invitationId: $invitationToken) {
          success
        }
      }`,
      variables: {
        invitationToken
      }
    },
    meta: {
      invitationToken,
      optimistic: true
    }
  }
}

export function resendInvitation (invitationToken) {
  return {
    type: RESEND_INVITATION,
    graphql: {
      query: `mutation ($invitationToken: ID) {
        resendInvitation(invitationId: $invitationToken) {
          success
        }
      }`,
      variables: {
        invitationToken
      }
    },
    meta: {
      invitationToken,
      optimistic: true
    }
  }
}

export function allowGroupInvites (groupId, data) {
  return {
    type: ALLOW_GROUP_INVITES,
    graphql: {
      query: `mutation ($groupId: ID, $data: Boolean) {
        allowGroupInvites(groupId: $groupId, data: $data) {
          id
        }
      }`,
      variables: {
        groupId,
        data
      }
    },
    meta: {
      groupId,
      optimistic: true
    }
  }
}

// expects props to be of the form {groupId}
export const getPendingInvites = ormCreateSelector(
  orm,
  (state, props) => props.groupId,
  ({ Invitation }, id) =>
    Invitation
      .filter(i => (i.group === id) && !!i.id)
      .orderBy(i => -new Date(i.createdAt))
      .toModelArray()
)

export function ormSessionReducer (session, { type, meta, payload }) {
  const { Group, Invitation } = session
  let group, invite

  switch (type) {
    case CREATE_INVITATIONS:
      payload.data.createInvitation.invitations.forEach(i =>
        Invitation.create({
          email: i.email,
          name: i.name || null,
          id: i.id,
          createdAt: new Date().toString(),
          group: meta.groupId
        }))
      break

    case RESEND_INVITATION_PENDING:
      invite = Invitation.withId(meta.invitationToken)
      if (!invite) break
      invite.update({ resent: true, lastSentAt: new Date() })
      break

    case EXPIRE_INVITATION_PENDING:
      invite = Invitation.withId(meta.invitationToken)
      invite.delete()
      break

    case REINVITE_ALL_PENDING:
      group = Group.withId(meta.groupId)
      group.pendingInvitations.update({ resent: true, lastSentAt: new Date() })
      break
  }
}
