/**
 * Scope Helper Functions
 *
 * Manages scope strings for the user access system.
 *
 * Scope formats:
 * - group:<groupId> - e.g., "group:123"
 * - track:<trackId> - e.g., "track:456"
 * - group_role:<groupId>:<roleId> - e.g., "group_role:123:789"
 * - common_role:<groupId>:<roleId> - e.g., "common_role:123:1"
 */

const SCOPE_TYPES = {
  GROUP: 'group',
  TRACK: 'track',
  GROUP_ROLE: 'group_role',
  COMMON_ROLE: 'common_role'
}

/**
 * Creates a scope string from type and entity ID
 *
 * @param {string} type - One of: 'group', 'track', 'group_role'
 * @param {string|number} entityId - The ID of the entity
 * @returns {string} The formatted scope string
 * @throws {Error} If type is invalid or entityId is missing
 */
function createScope (type, entityId) {
  if (!Object.values(SCOPE_TYPES).includes(type)) {
    throw new Error(`Invalid scope type: ${type}. Must be one of: ${Object.values(SCOPE_TYPES).join(', ')}`)
  }

  if (!entityId) {
    throw new Error('Entity ID is required to create a scope')
  }

  return `${type}:${entityId}`
}

/**
 * Parses a scope string into its component parts
 *
 * @param {string} scopeString - The scope string to parse
 * @returns {Object|null} Object with {type, entityId, groupId} or null if invalid
 */
function parseScope (scopeString) {
  if (!scopeString || typeof scopeString !== 'string') {
    return null
  }

  const parts = scopeString.split(':')

  // Simple scopes (group, track): type:entityId
  if (parts.length === 2) {
    const [type, entityId] = parts

    if (!Object.values(SCOPE_TYPES).includes(type)) {
      return null
    }

    if (!entityId) {
      return null
    }

    // Role scopes should have 3 parts, so if it's a role type with only 2 parts, it's invalid
    if (type === SCOPE_TYPES.GROUP_ROLE || type === SCOPE_TYPES.COMMON_ROLE) {
      return null
    }

    return {
      type,
      entityId
    }
  }

  // Role scopes: type:groupId:roleId
  if (parts.length === 3) {
    const [type, groupId, roleId] = parts

    if (type !== SCOPE_TYPES.GROUP_ROLE && type !== SCOPE_TYPES.COMMON_ROLE) {
      return null
    }

    if (!groupId || !roleId) {
      return null
    }

    return {
      type,
      groupId,
      entityId: roleId
    }
  }

  return null
}

/**
 * Validates a scope string
 *
 * @param {string} scopeString - The scope string to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidScope (scopeString) {
  return parseScope(scopeString) !== null
}

/**
 * Creates a group scope
 *
 * @param {string|number} groupId - The group ID
 * @returns {string} The group scope string
 */
function createGroupScope (groupId) {
  return createScope(SCOPE_TYPES.GROUP, groupId)
}

/**
 * Creates a track scope
 *
 * @param {string|number} trackId - The track ID
 * @returns {string} The track scope string
 */
function createTrackScope (trackId) {
  return createScope(SCOPE_TYPES.TRACK, trackId)
}

/**
 * Creates a group role scope
 *
 * @param {string|number} groupRoleId - The group role ID
 * @param {string|number} groupId - The group ID (required to avoid collisions)
 * @returns {string} The group role scope string
 */
function createGroupRoleScope (groupRoleId, groupId) {
  if (!groupId) {
    throw new Error('groupId is required for group role scopes')
  }
  return `${SCOPE_TYPES.GROUP_ROLE}:${groupId}:${groupRoleId}`
}

/**
 * Creates a common role scope
 *
 * @param {string|number} commonRoleId - The common role ID
 * @param {string|number} groupId - The group ID (required to avoid collisions)
 * @returns {string} The common role scope string
 */
function createCommonRoleScope (commonRoleId, groupId) {
  if (!groupId) {
    throw new Error('groupId is required for common role scopes')
  }
  return `${SCOPE_TYPES.COMMON_ROLE}:${groupId}:${commonRoleId}`
}

/**
 * Checks if a scope is of a specific type
 *
 * @param {string} scopeString - The scope string to check
 * @param {string} type - The type to check against
 * @returns {boolean} True if the scope is of the specified type
 */
function isScopeOfType (scopeString, type) {
  const parsed = parseScope(scopeString)
  return parsed ? parsed.type === type : false
}

/**
 * Extracts the entity ID from a scope string
 *
 * @param {string} scopeString - The scope string
 * @returns {string|null} The entity ID or null if invalid
 */
function getEntityIdFromScope (scopeString) {
  const parsed = parseScope(scopeString)
  return parsed ? parsed.entityId : null
}

/**
 * Creates multiple scopes from a content access definition
 *
 * @param {Object} contentAccess - Content access object with trackIds, groupIds, roleIds
 * @returns {string[]} Array of scope strings
 */
function createScopesFromContentAccess (contentAccess) {
  if (!contentAccess || typeof contentAccess !== 'object') {
    return []
  }

  const scopes = []

  // Add track scopes
  if (Array.isArray(contentAccess.trackIds)) {
    contentAccess.trackIds.forEach(trackId => {
      scopes.push(createTrackScope(trackId))
    })
  }

  // Add group scopes
  if (Array.isArray(contentAccess.groupIds)) {
    contentAccess.groupIds.forEach(groupId => {
      scopes.push(createGroupScope(groupId))
    })
  }

  // Note: Role scopes require groupId, so they cannot be created from accessGrants alone. Admins can already give roles to people, without the use of access grants
  // For paid content, roles must be created from content_access records which have both groupRoleId and groupId

  return scopes
}

module.exports = {
  SCOPE_TYPES,
  createScope,
  parseScope,
  isValidScope,
  createGroupScope,
  createTrackScope,
  createGroupRoleScope,
  createCommonRoleScope,
  isScopeOfType,
  getEntityIdFromScope,
  createScopesFromContentAccess
}
