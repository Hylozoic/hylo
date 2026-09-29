import { createSelector as ormCreateSelector } from 'redux-orm'
import { INVITE_ACCESS } from 'store/constants'
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

export const FETCH_INVITATION_SUBMISSIONS = `${MODULE_NAME}/FETCH_INVITATION_SUBMISSIONS`
export const CANCEL_INVITATION_SUBMISSION = `${MODULE_NAME}/CANCEL_INVITATION_SUBMISSION`

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

export function createInvitations (groupId, emails, groupRoleId = null, userIds = [], note = '') {
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
            error,
            status
          }
        }
      }`,
      variables: {
        groupId,
        data: {
          emails,
          userIds,
          groupRoleId,
          ...(note ? { note } : {})
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
export function fetchPendingInvitations (groupId) {
  return {
    type: FETCH_PENDING_INVITATIONS,
    graphql: {
      query: `query ($id: ID) {
        group (id: $id) {
          id
          invitePath
          myInviteAllowance
          pendingInvitations {
            hasMore
            items {
              id
              email
              name
              userId
              createdAt
              lastSentAt
              inviterAccess
              creator {
                id
                name
              }
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

export const INVITATION_SUBMISSIONS_PAGE_SIZE = 50

/**
 * With limited invite access: the addresses and people this person invited to the group lately,
 * shown the same way whether or not an invitation went out, newest first, a page at a time.
 */
export function fetchInvitationSubmissions (groupId, { first = INVITATION_SUBMISSIONS_PAGE_SIZE, offset = 0 } = {}) {
  return {
    type: FETCH_INVITATION_SUBMISSIONS,
    graphql: {
      query: `query ($id: ID, $first: Int, $offset: Int) {
        group (id: $id) {
          id
          myInvitationSubmissions (first: $first, offset: $offset) {
            total
            hasMore
            items {
              id
              email
              createdAt
              person {
                id
                name
                avatarUrl
              }
            }
          }
        }
      }`,
      variables: { id: groupId, first, offset }
    }
  }
}

export function cancelInvitationSubmission (submissionId) {
  return {
    type: CANCEL_INVITATION_SUBMISSION,
    graphql: {
      query: `mutation ($submissionId: ID) {
        cancelInvitationSubmission(submissionId: $submissionId) {
          success
        }
      }`,
      variables: { submissionId }
    },
    meta: { submissionId }
  }
}

export const FETCH_MY_INVITE_LINK = `${MODULE_NAME}/FETCH_MY_INVITE_LINK`
export const CREATE_MEMBER_INVITE_LINK = `${MODULE_NAME}/CREATE_MEMBER_INVITE_LINK`
export const RESET_MEMBER_INVITE_LINK = `${MODULE_NAME}/RESET_MEMBER_INVITE_LINK`

/** With limited invite access: this person's personal invite link to the group, if they have made one. */
export function fetchMyInviteLink (groupId) {
  return {
    type: FETCH_MY_INVITE_LINK,
    graphql: {
      query: `query ($id: ID) {
        group (id: $id) {
          id
          myInviteLink {
            path
            createdAt
          }
        }
      }`,
      variables: { id: groupId }
    }
  }
}

/** Make this person's personal invite link to the group (or get the one they have). */
export function createMemberInviteLink (groupId) {
  return {
    type: CREATE_MEMBER_INVITE_LINK,
    graphql: {
      query: `mutation ($groupId: ID) {
        createMemberInviteLink(groupId: $groupId) {
          path
          createdAt
        }
      }`,
      variables: { groupId }
    }
  }
}

/** Stop this person's personal invite link working and make a new one. */
export function resetMemberInviteLink (groupId) {
  return {
    type: RESET_MEMBER_INVITE_LINK,
    graphql: {
      query: `mutation ($groupId: ID) {
        resetMemberInviteLink(groupId: $groupId) {
          path
          createdAt
        }
      }`,
      variables: { groupId }
    }
  }
}

export const INVITEABLE_PEOPLE_PAGE_SIZE = 15

/**
 * People who can be invited: people visible to the current user (personFilter) who are not
 * already members of the group, or (for spaces) parent-group members not already in the space.
 * With sharedGroupsOnly (members with limited invite access), only people who share a group
 * with the current user. Loads one page at a time.
 */
export function fetchInviteablePeople ({
  groupId,
  parentGroupId,
  autocomplete = '',
  first = INVITEABLE_PEOPLE_PAGE_SIZE,
  offset = 0,
  sharedGroupsOnly = false
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
      query: `query ($autocomplete: String, $first: Int, $offset: Int, $excludeGroupId: ID, $sharedGroupsOnly: Boolean) {
        people (first: $first, offset: $offset, autocomplete: $autocomplete, sortBy: "name", order: "asc", excludeGroupId: $excludeGroupId, sharedGroupsOnly: $sharedGroupsOnly) {
          hasMore
          items {
            id
            name
            avatarUrl
          }
        }
      }`,
      variables: { autocomplete, first, offset, excludeGroupId: groupId, sharedGroupsOnly }
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
        .filter(invitation => invitation.inviterAccess !== INVITE_ACCESS.limited)
        .update({ resent: true, lastSentAt: new Date() })
      break
  }
}
