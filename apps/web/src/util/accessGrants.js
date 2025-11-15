/**
 * Utility functions for working with accessGrants data from Stripe offerings
 *
 * accessGrants can be either a JSON string or an object with the structure:
 * {
 *   trackIds: [1, 2, 3],
 *   groupIds: [4, 5, 6],
 *   roleIds: [7, 8, 9]
 * }
 */

/**
 * Parses accessGrants from either a JSON string or an object
 * @param {string|object|null|undefined} accessGrants - The accessGrants value to parse
 * @returns {object} Parsed accessGrants object, or empty object if invalid
 */
export function parseAccessGrants (accessGrants) {
  if (!accessGrants) {
    return {}
  }

  // If it's already an object, use it directly
  if (typeof accessGrants === 'object' && !Array.isArray(accessGrants)) {
    return accessGrants
  }

  // If it's a string, try to parse it
  if (typeof accessGrants === 'string') {
    try {
      return JSON.parse(accessGrants)
    } catch (e) {
      console.warn('Failed to parse accessGrants as JSON:', e)
      return {}
    }
  }

  return {}
}

/**
 * Checks if an offering grants access to a specific track
 * @param {object} offering - The offering object with tracks relation or accessGrants
 * @param {string|number} trackId - The track ID to check
 * @returns {boolean} True if the offering grants access to the track
 */
export function offeringGrantsTrackAccess (offering, trackId) {
  if (!offering || !trackId) {
    return false
  }

  // Prefer tracks relation if available
  if (offering.tracks && Array.isArray(offering.tracks)) {
    return offering.tracks.some(track => parseInt(track.id) === parseInt(trackId))
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)

  if (accessGrants.trackIds && Array.isArray(accessGrants.trackIds)) {
    return accessGrants.trackIds.some(id => parseInt(id) === parseInt(trackId))
  }

  return false
}

/**
 * Checks if an offering grants access to a specific group
 * @param {object} offering - The offering object with accessGrants
 * @param {string|number} groupId - The group ID to check
 * @returns {boolean} True if the offering grants access to the group
 */
export function offeringGrantsGroupAccess (offering, groupId) {
  if (!offering || !groupId) {
    return false
  }

  const accessGrants = parseAccessGrants(offering.accessGrants)

  if (accessGrants.groupIds && Array.isArray(accessGrants.groupIds)) {
    return accessGrants.groupIds.some(id => parseInt(id) === parseInt(groupId))
  }

  return false
}

/**
 * Checks if an offering has any track access grants
 * @param {object} offering - The offering object with tracks relation or accessGrants
 * @returns {boolean} True if the offering grants access to any tracks
 */
export function offeringHasTrackAccess (offering) {
  if (!offering) {
    return false
  }

  // Prefer tracks relation if available
  if (offering.tracks && Array.isArray(offering.tracks)) {
    return offering.tracks.length > 0
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)
  return accessGrants.trackIds && Array.isArray(accessGrants.trackIds) && accessGrants.trackIds.length > 0
}

/**
 * Checks if an offering has any group access grants
 * @param {object} offering - The offering object with accessGrants
 * @returns {boolean} True if the offering grants access to any groups
 */
export function offeringHasGroupAccess (offering) {
  if (!offering) {
    return false
  }

  const accessGrants = parseAccessGrants(offering.accessGrants)
  return accessGrants.groupIds && Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0
}

/**
 * Checks if an offering has any role access grants
 * @param {object} offering - The offering object with roles relation or accessGrants
 * @returns {boolean} True if the offering grants access to any roles
 */
export function offeringHasRoleAccess (offering) {
  if (!offering) {
    return false
  }

  // Prefer roles relation if available
  if (offering.roles && Array.isArray(offering.roles)) {
    return offering.roles.length > 0
  }

  // Fallback to parsing accessGrants
  const accessGrants = parseAccessGrants(offering.accessGrants)
  return accessGrants.roleIds && Array.isArray(accessGrants.roleIds) && accessGrants.roleIds.length > 0
}
