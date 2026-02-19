/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'user_scopes',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User, 'user_id')
  },

  /**
   * Check if this scope is currently valid (not expired)
   * @returns {Boolean}
   */
  isValid: function () {
    const expiresAt = this.get('expires_at')
    return !expiresAt || new Date(expiresAt) > new Date()
  }

}, {
  /**
   * Check if a user has access to a specific scope
   * This is the main access control function for the scope system
   * 
   * @param {String|Number} userId - User ID to check
   * @param {String} requiredScope - Scope string to check (e.g., 'group:123', 'track:456')
   * @param {Date} [now] - Current time for expiration check (defaults to now)
   * @returns {Promise<Boolean>}
   */
  canAccess: async function (userId, requiredScope, now = new Date()) {
    const result = await bookshelf.knex('user_scopes')
      .where({ user_id: userId, scope: requiredScope })
      .where(function () {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', now)
      })
      .first()
    
    return !!result
  },

  /**
   * Get all valid scopes for a user
   * @param {String|Number} userId - User ID
   * @param {Date} [now] - Current time for expiration check (defaults to now)
   * @returns {Promise<Array<String>>} Array of scope strings
   */
  getUserScopes: async function (userId, now = new Date()) {
    const results = await bookshelf.knex('user_scopes')
      .where({ user_id: userId })
      .where(function () {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', now)
      })
      .select('scope')
    
    return results.map(r => r.scope)
  },

  /**
   * Get all scopes for a user of a specific type
   * @param {String|Number} userId - User ID
   * @param {String} scopeType - Scope type ('group', 'track', 'group_role')
   * @param {Date} [now] - Current time for expiration check (defaults to now)
   * @returns {Promise<Array<String>>} Array of scope strings
   */
  getUserScopesByType: async function (userId, scopeType, now = new Date()) {
    const results = await bookshelf.knex('user_scopes')
      .where({ user_id: userId })
      .where('scope', 'like', `${scopeType}:%`)
      .where(function () {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', now)
      })
      .select('scope')
    
    return results.map(r => r.scope)
  },

  /**
   * Get detailed scope information for a user
   * @param {String|Number} userId - User ID
   * @param {Date} [now] - Current time for expiration check (defaults to now)
   * @returns {Promise<Array<Object>>} Array of scope records with details
   */
  getUserScopeDetails: async function (userId, now = new Date()) {
    return await bookshelf.knex('user_scopes')
      .where({ user_id: userId })
      .where(function () {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', now)
      })
      .select('scope', 'expires_at', 'source_kind', 'source_id', 'created_at')
  },

  /**
   * Check if a user has any of the provided scopes
   * @param {String|Number} userId - User ID
   * @param {Array<String>} requiredScopes - Array of scope strings
   * @param {Date} [now] - Current time for expiration check (defaults to now)
   * @returns {Promise<Boolean>}
   */
  hasAnyScope: async function (userId, requiredScopes, now = new Date()) {
    const result = await bookshelf.knex('user_scopes')
      .where({ user_id: userId })
      .whereIn('scope', requiredScopes)
      .where(function () {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', now)
      })
      .first()
    
    return !!result
  }
})

