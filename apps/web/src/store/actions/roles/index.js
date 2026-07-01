import {
  ADD_GROUP_ROLE,
  ADD_ROLE_TO_MEMBER,
  FETCH_MEMBERS_FOR_GROUP_ROLE,
  REMOVE_ROLE_FROM_MEMBER,
  UPDATE_GROUP_ROLE
} from 'store/constants'

export function addGroupRole ({ groupId, name, description, emoji }) {
  return {
    type: ADD_GROUP_ROLE,
    graphql: {
      query: `mutation ($groupId: ID, $name: String, $description: String, $emoji: String) {
        addGroupRole (groupId: $groupId, name: $name, description: $description, emoji: $emoji) {
          id
          name
          description
          emoji
          active
          type
        }
      }`,
      variables: {
        groupId, name, description, emoji
      }
    },
    meta: {
      groupId,
      name,
      description,
      emoji,
      optimistic: true
    }
  }
}

export function updateGroupRole ({ active, groupId, groupRoleId, name, description, emoji }) {
  return {
    type: UPDATE_GROUP_ROLE,
    graphql: {
      query: `mutation ($groupRoleId: ID, $active: Boolean, $name: String, $description: String, $emoji: String, $groupId: ID) {
        updateGroupRole (groupRoleId: $groupRoleId, active: $active, groupId: $groupId, name: $name, description: $description, emoji: $emoji) {
          active
          id
          name
          description
          emoji
          active
          type
        }
      }`,
      variables: {
        active, groupRoleId, name, description, emoji, groupId
      }
    },
    meta: {
      optimistic: true
    }
  }
}

export function addRoleToMember ({ personId, groupId, roleId }) {
  return {
    type: ADD_ROLE_TO_MEMBER,
    graphql: {
      query: `mutation ($personId: ID, $groupId: ID, $roleId: ID) {
        addRoleToMember(personId: $personId, groupId: $groupId, roleId: $roleId) {
          id
        }
      }`,
      variables: { personId, groupId, roleId }
    },
    meta: {
      personId,
      groupId,
      roleId,
      optimistic: true
    }
  }
}

export function removeRoleFromMember ({ personId, groupId, roleId }) {
  return {
    type: REMOVE_ROLE_FROM_MEMBER,
    graphql: {
      query: `mutation ($personId: ID, $groupId: ID, $roleId: ID) {
        removeRoleFromMember(personId: $personId, groupId: $groupId, roleId: $roleId) {
          success
          error
        }
      }`,
      variables: { personId, groupId, roleId }
    },
    meta: {
      personId,
      groupId,
      roleId,
      optimistic: true
    }
  }
}

export function fetchMembersForGroupRole ({ id, roleId: groupRoleId }) {
  return {
    type: FETCH_MEMBERS_FOR_GROUP_ROLE,
    graphql: {
      query: `query fetchMembersForGroupRole ($id: ID, $groupRoleId: ID) {
        group (id: $id) {
          id
          members (first: 50, groupRoleId: $groupRoleId) {
            hasMore
            items {
              id
              name
              avatarUrl
              groupRoles {
                items {
                  id
                  name
                  emoji
                  active
                  groupId
                  type
                  responsibilities {
                    items {
                      id
                      title
                      description
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      variables: {
        id, groupRoleId
      }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}
