/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'groups_roles',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group)
  },

  responsibilities: function () {
    return this.belongsToMany(Responsibility, 'group_roles_responsibilities', 'group_role_id', 'responsibility_id')
  },

  /**
   * Get the scope strings that this role grants
   * @returns {Array<String>} Array of scope strings (e.g., ['group:123', 'track:456'])
   */
  getScopes: function () {
    const scopes = this.get('scopes')
    // scopes is a JSONB array, return it or empty array if null
    return scopes || []
  },

  /**
   * Set the scopes for this role
   * Note: This will trigger database triggers to update user_scopes for all users with this role
   * @param {Array<String>} scopeStrings - Array of scope strings
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  setScopes: async function (scopeStrings, { transacting } = {}) {
    return this.save({ scopes: scopeStrings }, { transacting })
  },

  /**
   * Add a scope to this role
   * @param {String} scopeString - Scope string to add
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  addScope: async function (scopeString, { transacting } = {}) {
    const currentScopes = this.getScopes()
    if (!currentScopes.includes(scopeString)) {
      currentScopes.push(scopeString)
      return this.setScopes(currentScopes, { transacting })
    }
    return this
  },

  /**
   * Remove a scope from this role
   * @param {String} scopeString - Scope string to remove
   * @param {Object} options - Options including transacting
   * @returns {Promise<GroupRole>}
   */
  removeScope: async function (scopeString, { transacting } = {}) {
    const currentScopes = this.getScopes()
    const filtered = currentScopes.filter(s => s !== scopeString)
    if (filtered.length !== currentScopes.length) {
      return this.setScopes(filtered, { transacting })
    }
    return this
  }

}, {

})
