import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

export const MODULE_NAME = 'InviteSettingsTab'
export const CREATE_INVITATIONS = `${MODULE_NAME}/CREATE_INVITATIONS`
export const CREATE_INVITATIONS_PENDING = `${MODULE_NAME}/CREATE_INVITATIONS_PENDING`
export const FETCH_PENDING_INVITATIONS = `${MODULE_NAME}/FETCH_PENDING_INVITATIONS`
export const FETCH_INVITEABLE_PEOPLE = `${MODULE_NAME}/FETCH_INVITEABLE_PEOPLE`
export const FETCH_INVITE_RECENT_CONTACTS = `${MODULE_NAME}/FETCH_INVITE_RECENT_CONTACTS`

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

export function createInvitations (groupId, emails, groupRoleId = null, userIds = []) {
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

/**
 * Loads invitePath, pending invitations and, for people with limited invite access, how many
 * more addresses they can invite today, so the invite UI works outside Group Settings.
 */
export function fetchPendingInvitations (groupId, { first = 20, offset = 0, onlyMine = false } = {}) {
  return {
    type: FETCH_PENDING_INVITATIONS,
    graphql: {
      query: `query ($id: ID, $first: Int, $offset: Int, $onlyMine: Boolean) {
        group (id: $id) {
          id
          accessibility
          visibility
          invitePath
          myInviteAllowance
          inviteLinks {
            id
            name
            accessCode
            url
            grantAccess
            numJoinedUsers
            grantedRoles {
              id
              name
              emoji
            }
          }
          pendingInvitations (first: $first, offset: $offset, onlyMine: $onlyMine) {
            total
            hasMore
            items {
              id
              email
              name
              userId
              createdAt
              lastSentAt
              creator {
                id
                name
              }
            }
          }
        }
      }`,
      variables: { id: groupId, first, offset, onlyMine }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}

export const PENDING_INVITES_PAGE_SIZE = 20

export function createGroupInviteLink (groupId, data) {
  return {
    type: `${MODULE_NAME}/CREATE_INVITE_LINK`,
    graphql: {
      query: `mutation ($groupId: ID!, $data: GroupInviteLinkInput!) {
        createGroupInviteLink(groupId: $groupId, data: $data) {
          id
          name
          accessCode
          url
          grantAccess
          numJoinedUsers
          grantedRoles { id name emoji }
        }
      }`,
      variables: { groupId, data }
    },
    meta: { groupId }
  }
}

export function updateGroupInviteLink (id, data) {
  return {
    type: `${MODULE_NAME}/UPDATE_INVITE_LINK`,
    graphql: {
      query: `mutation ($id: ID!, $data: GroupInviteLinkUpdateInput!) {
        updateGroupInviteLink(id: $id, data: $data) {
          id
          name
          accessCode
          url
          grantAccess
          numJoinedUsers
          grantedRoles { id name emoji }
        }
      }`,
      variables: { id, data }
    },
    meta: { id }
  }
}

export function deleteGroupInviteLink (id) {
  return {
    type: `${MODULE_NAME}/DELETE_INVITE_LINK`,
    graphql: {
      query: `mutation ($id: ID!) {
        deleteGroupInviteLink(id: $id) { success }
      }`,
      variables: { id }
    },
    meta: { id }
  }
}

export const INVITEABLE_PEOPLE_PAGE_SIZE = 15
export const INVITE_RECENT_CONTACTS_PAGE_SIZE = 20

/**
 * Recent message contacts for the default invite dropdown, newest first.
 * Excludes active members of the group and people with a blank name.
 */
export function fetchInviteRecentContacts ({
  groupId,
  first = INVITE_RECENT_CONTACTS_PAGE_SIZE,
  offset = 0
} = {}) {
  return {
    type: FETCH_INVITE_RECENT_CONTACTS,
    graphql: {
      query: `query ($first: Int, $offset: Int, $excludeGroupId: ID) {
        connections(first: $first, offset: $offset, excludeGroupId: $excludeGroupId, requireName: true) {
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
      variables: { first, offset, excludeGroupId: groupId }
    }
  }
}

/**
 * People who can be invited: people visible to the current user (personFilter),
 * or (for spaces) parent-group members not already in the space. Loads one page at a time.
 */
export function fetchInviteablePeople ({
  groupId,
  parentGroupId,
  autocomplete = '',
  first = INVITEABLE_PEOPLE_PAGE_SIZE,
  offset = 0,
  excludeGroupId
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
                groupRoles(groupId: $parentGroupId) {
                  items {
                    id
                  }
                }
              }
            }
          }
        }`,
        variables: {
          parentGroupId,
          groupId,
          autocomplete,
          first,
          offset
        }
      }
    }
  }

  return {
    type: FETCH_INVITEABLE_PEOPLE,
    graphql: {
      query: `query ($autocomplete: String, $first: Int, $offset: Int, $excludeGroupId: ID) {
        people (first: $first, offset: $offset, autocomplete: $autocomplete, sortBy: "name", order: "asc", excludeGroupId: $excludeGroupId, requireName: true) {
          hasMore
          items {
            id
            name
            avatarUrl
          }
        }
      }`,
      variables: { autocomplete, first, offset, excludeGroupId }
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
      payload.data.createInvitation.invitations.filter(i => i.id).forEach(i =>
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
      // reinviteAll leaves invitations sent by members to the automatic reminders
      group.pendingInvitations
        .update({ resent: true, lastSentAt: new Date() })
      break
  }
}
