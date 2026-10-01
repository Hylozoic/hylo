import randomstring from 'randomstring'

// Longer than the codes of group join links (Group.getNewAccessCode), so a
// newly made join link code can never match a member's code
const CODE_LENGTH = 16
const UNIQUE_VIOLATION = '23505'

function withTransaction (query, transacting) {
  return transacting ? query.transacting(transacting) : query
}

/**
 * A personal invite link of a member with limited invite access: one active
 * link per member and top-level group, at /groups/<slug>/join/<code> like the
 * group's join link. A link never expires. Resetting it revokes it and makes a
 * new one, and it is revoked when the member leaves or is removed, or can no
 * longer invite people after the group's invite policy changes.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'member_invite_links',
  requireFetch: false,

  group: function () {
    return this.belongsTo(Group)
  },

  user: function () {
    return this.belongsTo(User)
  },

  isRevoked: function () {
    return !!this.get('revoked_at')
  },

  /** The link's path, the same shape as a group join link. */
  path: function (group) {
    return `/groups/${group.get('slug')}/join/${this.get('code')}`
  }
}, {
  CODE_LENGTH,

  /**
   * A code no member link and no group join link uses, compared without case
   * as join link codes are.
   */
  newCode: async function ({ transacting } = {}) {
    for (;;) {
      const code = randomstring.generate({ length: CODE_LENGTH, charset: 'alphanumeric' })
      const accessCode = await withTransaction(bookshelf.knex('groups')
        .whereRaw('lower(access_code) = lower(?)', [code]).first('id'), transacting)
      const memberCode = await withTransaction(bookshelf.knex('member_invite_links')
        .whereRaw('lower(code) = lower(?)', [code]).first('id'), transacting)
      if (!accessCode && !memberCode) return code
    }
  },

  /** The link with this code, revoked or not, or null. */
  findByCode: function (code, { transacting } = {}) {
    if (!code || typeof code !== 'string') return Promise.resolve(null)
    return MemberInviteLink.query(q => q.whereRaw('lower(code) = lower(?)', [code]))
      .fetch({ transacting })
  },

  /** This member's active link to this group, or null. */
  findActive: function ({ groupId, userId }, { transacting } = {}) {
    return MemberInviteLink.query(q => {
      q.where({ group_id: groupId, user_id: userId })
      q.whereNull('revoked_at')
    }).fetch({ transacting })
  },

  /** This member's active link to this group, made now if they have none. */
  findOrCreate: async function ({ groupId, userId }, { transacting } = {}) {
    const existing = await MemberInviteLink.findActive({ groupId, userId }, { transacting })
    if (existing) return existing
    try {
      return await bookshelf.transaction(async trx => {
        const code = await MemberInviteLink.newCode({ transacting: trx })
        return MemberInviteLink.forge({ group_id: groupId, user_id: userId, code, created_at: new Date() })
          .save(null, { transacting: trx })
      })
    } catch (err) {
      // Made at the same time by another request
      if (err.code === UNIQUE_VIOLATION) {
        const made = await MemberInviteLink.findActive({ groupId, userId }, { transacting })
        if (made) return made
      }
      throw err
    }
  },

  /** Revoke this member's active link to this group and make a new one. */
  reset: async function ({ groupId, userId }) {
    return bookshelf.transaction(async transacting => {
      await MemberInviteLink.revoke({ groupId, userIds: [userId] }, { transacting })
      const code = await MemberInviteLink.newCode({ transacting })
      return MemberInviteLink.forge({ group_id: groupId, user_id: userId, code, created_at: new Date() })
        .save(null, { transacting })
    })
  },

  /**
   * Revoke the active links of these members to this group, or, without
   * userIds, of every member of it, or, without groupId, of these members to
   * every group (when they leave Hylo).
   */
  revoke: function ({ groupId, userIds }, { transacting } = {}) {
    if (!groupId && !userIds) throw new Error('MemberInviteLink.revoke needs a groupId or userIds')
    let query = bookshelf.knex('member_invite_links').whereNull('revoked_at')
    if (groupId) query = query.where('group_id', groupId)
    if (userIds) query = query.whereIn('user_id', userIds)
    return withTransaction(query.update({ revoked_at: new Date() }), transacting)
  },

  /**
   * Revoke the active links to this group of everyone who can no longer invite
   * people to it, for example after its "Who can add new members?" policy was
   * narrowed. Returns the ids of the members whose links were revoked. Does
   * nothing while member invitations are switched off, when nobody has
   * limited invite access.
   */
  revokeWithoutInviteAccess: async function (groupId, { transacting } = {}) {
    if (!GroupRole.memberInvitesEnabled()) return []
    const userIds = await withTransaction(bookshelf.knex('member_invite_links')
      .where('group_id', groupId)
      .whereNull('revoked_at')
      .pluck('user_id'), transacting)
    const revokedIds = []
    for (const userId of userIds) {
      if (!await GroupMembership.inviteAccess(userId, groupId, { transacting })) revokedIds.push(userId)
    }
    if (revokedIds.length > 0) await MemberInviteLink.revoke({ groupId, userIds: revokedIds }, { transacting })
    return revokedIds
  }
})
