/**
 * Bots Settings Store
 *
 * Actions for managing bots in groups
 */

export const MODULE_NAME = 'BotsSettings'

export const FETCH_GROUP_BOTS = `${MODULE_NAME}/FETCH_GROUP_BOTS`
export const FETCH_AVAILABLE_BOTS = `${MODULE_NAME}/FETCH_AVAILABLE_BOTS`
export const INVITE_BOT_TO_GROUP = `${MODULE_NAME}/INVITE_BOT_TO_GROUP`
export const REMOVE_BOT_FROM_GROUP = `${MODULE_NAME}/REMOVE_BOT_FROM_GROUP`
export const UPDATE_BOT_PERMISSIONS = `${MODULE_NAME}/UPDATE_BOT_PERMISSIONS`

/**
 * Fetch bots currently in a group
 */
export function fetchGroupBots (groupId) {
  return {
    type: FETCH_GROUP_BOTS,
    graphql: {
      query: `query FetchGroupBots($groupId: ID!) {
        group(id: $groupId) {
          id
          botPermissions {
            items {
              id
              botUserId
              permissions
              isActive
              createdAt
              bot {
                id
                name
                avatarUrl
              }
              invitedBy {
                id
                name
              }
            }
          }
        }
      }`,
      variables: { groupId }
    },
    meta: { groupId }
  }
}

/**
 * Fetch available bots that can be invited
 */
export function fetchAvailableBots (searchTerm = '') {
  return {
    type: FETCH_AVAILABLE_BOTS,
    graphql: {
      query: `query FetchAvailableBots($search: String) {
        availableBots(search: $search) {
          items {
            id
            name
            avatarUrl
            application {
              id
              name
              description
            }
          }
        }
      }`,
      variables: { search: searchTerm }
    },
    meta: { searchTerm }
  }
}

/**
 * Invite a bot to a group
 */
export function inviteBotToGroup (botUserId, groupId, permissions) {
  return {
    type: INVITE_BOT_TO_GROUP,
    graphql: {
      query: `mutation InviteBotToGroup($data: InviteBotInput!) {
        inviteBotToGroup(data: $data) {
          id
          botUserId
          groupId
          permissions
          isActive
          bot {
            id
            name
            avatarUrl
          }
        }
      }`,
      variables: {
        data: {
          botUserId,
          groupId,
          permissions
        }
      }
    },
    meta: { botUserId, groupId, permissions }
  }
}

/**
 * Remove a bot from a group
 */
export function removeBotFromGroup (botGroupPermissionId) {
  return {
    type: REMOVE_BOT_FROM_GROUP,
    graphql: {
      query: `mutation RemoveBotFromGroup($botGroupPermissionId: ID!) {
        removeBotFromGroup(botGroupPermissionId: $botGroupPermissionId) {
          success
        }
      }`,
      variables: { botGroupPermissionId }
    },
    meta: { botGroupPermissionId }
  }
}

/**
 * Update bot permissions in a group
 */
export function updateBotPermissions (botGroupPermissionId, permissions) {
  return {
    type: UPDATE_BOT_PERMISSIONS,
    graphql: {
      query: `mutation UpdateBotPermissions($botGroupPermissionId: ID!, $permissions: [String!]!) {
        updateBotPermissions(botGroupPermissionId: $botGroupPermissionId, permissions: $permissions) {
          id
          permissions
        }
      }`,
      variables: { botGroupPermissionId, permissions }
    },
    meta: { botGroupPermissionId, permissions }
  }
}

/**
 * Available bot permissions
 */
export const BOT_PERMISSIONS = [
  { key: 'read_posts', label: 'Read Posts', description: 'Read posts in the group' },
  { key: 'create_posts', label: 'Create Posts', description: 'Create new posts' },
  { key: 'create_comments', label: 'Create Comments', description: 'Add comments to posts' },
  { key: 'read_members', label: 'Read Members', description: 'View group member list' },
  { key: 'send_messages', label: 'Send Messages', description: 'Send direct messages' },
  { key: 'manage_events', label: 'Manage Events', description: 'Create and manage events' },
  { key: 'read_announcements', label: 'Read Announcements', description: 'View announcements' },
  { key: 'create_announcements', label: 'Create Announcements', description: 'Create announcements' }
]
