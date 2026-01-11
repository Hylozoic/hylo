/**
 * Scope Helper Functions
 * 
 * Manages scope strings for the user access system.
 * 
 * Scope formats:
 * - group:<groupId> - e.g., "group:123"
 * - track:<trackId> - e.g., "track:456"
 * - group_role:<groupRoleId> - e.g., "group_role:789"
 */

const SCOPE_TYPES = {
  GROUP: 'group',
  TRACK: 'track',
  GROUP_ROLE: 'group_role'
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
 * @returns {Object|null} Object with {type, entityId} or null if invalid
 */
function parseScope (scopeString) {
  if (!scopeString || typeof scopeString !== 'string') {
    return null
  }

  const parts = scopeString.split(':')
  
  if (parts.length !== 2) {
    return null
  }

  const [type, entityId] = parts

  if (!Object.values(SCOPE_TYPES).includes(type)) {
    return null
  }

  if (!entityId) {
    return null
  }

  return {
    type,
    entityId
  }
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
 * @returns {string} The group role scope string
 */
function createGroupRoleScope (groupRoleId) {
  return createScope(SCOPE_TYPES.GROUP_ROLE, groupRoleId)
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

  // Add group role scopes
  if (Array.isArray(contentAccess.roleIds)) {
    contentAccess.roleIds.forEach(roleId => {
      scopes.push(createGroupRoleScope(roleId))
    })
  }

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
  isScopeOfType,
  getEntityIdFromScope,
  createScopesFromContentAccess
}

