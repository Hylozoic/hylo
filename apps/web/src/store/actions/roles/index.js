import {
  ADD_GROUP_ROLE,
  ADD_ROLE_TO_MEMBER,
  FETCH_GROUP_ROLE_DETAILS,
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

export const ROLE_MEMBERS_PAGE_SIZE = 20

export function fetchGroupRoleDetails ({ id, roleId: groupRoleId, first = ROLE_MEMBERS_PAGE_SIZE, offset = 0 }) {
  return {
    type: FETCH_GROUP_ROLE_DETAILS,
    graphql: {
      query: `query fetchGroupRoleDetails ($id: ID, $groupRoleId: ID, $first: Int, $offset: Int) {
        group (id: $id) {
          id
          members (first: $first, offset: $offset, groupRoleId: $groupRoleId) {
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
        responsibilities (groupRoleId: $groupRoleId) {
          id
          title
          type
          description
          responsibilityId
        }
      }`,
      variables: {
        id, groupRoleId, first, offset
      }
    },
    meta: {
      extractModel: {
        getRoot: data => data.group,
        modelName: 'Group',
        append: true
      }
    }
  }
}

export function fetchMembersForGroupRole ({ id, roleId: groupRoleId, first = ROLE_MEMBERS_PAGE_SIZE, offset = 0 }) {
  return {
    type: FETCH_MEMBERS_FOR_GROUP_ROLE,
    graphql: {
      query: `query fetchMembersForGroupRole ($id: ID, $groupRoleId: ID, $first: Int, $offset: Int) {
        group (id: $id) {
          id
          members (first: $first, offset: $offset, groupRoleId: $groupRoleId) {
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
        id, groupRoleId, first, offset
      }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}
