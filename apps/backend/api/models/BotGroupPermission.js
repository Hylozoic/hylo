/**
 * BotGroupPermission Model
 *
 * Represents the permissions granted to a bot when invited to a group.
 * Similar to Discord's role-based permissions per server.
 */

module.exports = bookshelf.Model.extend({
  tableName: 'bot_group_permissions',
  requireFetch: false,
  hasTimestamps: ['created_at', null],

  bot: function () {
    return this.belongsTo(User, 'bot_user_id')
  },

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  invitedBy: function () {
    return this.belongsTo(User, 'invited_by_id')
  },

  /**
   * Get permissions as array
   */
  getPermissions () {
    const perms = this.get('permissions')
    if (Array.isArray(perms)) return perms
    if (typeof perms === 'string') {
      return perms.replace(/[{}]/g, '').split(',').filter(Boolean)
    }
    return []
  },

  /**
   * Check if bot has a specific permission in this group
   */
  hasPermission (permission) {
    return this.getPermissions().includes(permission)
  },

  /**
   * Check if bot has any of the given permissions
   */
  hasAnyPermission (permissions) {
    const granted = this.getPermissions()
    return permissions.some(p => granted.includes(p))
  },

  /**
   * Check if bot has all of the given permissions
   */
  hasAllPermissions (permissions) {
    const granted = this.getPermissions()
    return permissions.every(p => granted.includes(p))
  }

}, {
  // Static methods

  /**
   * Find by ID
   */
  find (id, opts = {}) {
    if (!id) return Promise.resolve(null)
    return this.where({ id }).fetch(opts)
  },

  /**
   * Find permissions for a bot in a specific group (active only)
   */
  findForBotInGroup (botUserId, groupId, opts = {}) {
    if (!botUserId || !groupId) return Promise.resolve(null)
    return this.where({
      bot_user_id: botUserId,
      group_id: groupId,
      is_active: true
    }).fetch(opts)
  },

  /**
   * Find permissions for a bot in a specific group (including inactive)
   */
  findForBotInGroupAny (botUserId, groupId, opts = {}) {
    if (!botUserId || !groupId) return Promise.resolve(null)
    return this.where({
      bot_user_id: botUserId,
      group_id: groupId
    }).fetch(opts)
  },

  /**
   * Find all groups where a bot has been invited
   */
  findGroupsForBot (botUserId, opts = {}) {
    if (!botUserId) return Promise.resolve([])
    return this.where({
      bot_user_id: botUserId,
      is_active: true
    }).fetchAll(opts)
  },

  /**
   * Find all bots in a group
   */
  findBotsInGroup (groupId, opts = {}) {
    if (!groupId) return Promise.resolve([])
    return this.where({
      group_id: groupId,
      is_active: true
    }).fetchAll(opts)
  },

  /**
   * Invite a bot to a group (or reactivate if previously removed)
   */
  async inviteBot ({ botUserId, groupId, invitedById, permissions }, opts = {}) {
    // Check if bot was ever in group (including inactive)
    const existing = await this.findForBotInGroupAny(botUserId, groupId, opts)

    if (existing) {
      // Reactivate and update permissions
      await existing.save({
        is_active: true,
        permissions: permissions || [],
        invited_by_id: invitedById
      }, { patch: true, ...opts })
      return existing
    }

    // Create new permission entry
    return this.forge({
      bot_user_id: botUserId,
      group_id: groupId,
      invited_by_id: invitedById,
      permissions: permissions || [],
      is_active: true
    }).save(null, opts)
  },

  /**
   * Remove a bot from a group (soft delete)
   */
  async removeBot (botUserId, groupId, opts = {}) {
    const existing = await this.findForBotInGroup(botUserId, groupId, opts)
    if (!existing) return null

    await existing.save({ is_active: false }, { patch: true, ...opts })
    return existing
  },

  /**
   * Update permissions for a bot in a group
   */
  async updatePermissions (botUserId, groupId, permissions, opts = {}) {
    const existing = await this.findForBotInGroup(botUserId, groupId, opts)
    if (!existing) throw new Error('Bot not found in group')

    await existing.save({ permissions }, { patch: true, ...opts })
    return existing
  },

  /**
   * Check if a bot has permission in a group
   */
  async checkPermission (botUserId, groupId, permission) {
    const bgp = await this.findForBotInGroup(botUserId, groupId)
    if (!bgp) return false
    return bgp.hasPermission(permission)
  },

  /**
   * Available permission types
   */
  PERMISSIONS: {
    READ_POSTS: 'read_posts',
    CREATE_POSTS: 'create_posts',
    CREATE_COMMENTS: 'create_comments',
    READ_MEMBERS: 'read_members',
    SEND_MESSAGES: 'send_messages',
    MANAGE_EVENTS: 'manage_events',
    READ_ANNOUNCEMENTS: 'read_announcements',
    CREATE_ANNOUNCEMENTS: 'create_announcements'
  }
})
