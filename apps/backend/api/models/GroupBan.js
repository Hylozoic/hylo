import { GraphQLError } from 'graphql'

// The error every join route gives someone blocked from rejoining a group
const BANNED_ERROR = "You can't join this group"
// What a steward is told when accepting a request from someone blocked from rejoining
const BANNED_REQUEST_ERROR = 'This person is blocked from rejoining this group. Lift the block first.'
const UNIQUE_VIOLATION = '23505'

function withTransaction (query, transacting) {
  return transacting ? query.transacting(transacting) : query
}

/**
 * A person a steward removed from a group and blocked from rejoining it. The
 * block lasts until a steward lifts it. While it lasts the person can't come
 * back through the group's join link, a member's invite link, an email
 * invitation or a request to join. A block on a group also covers its spaces.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'group_bans',
  requireFetch: false,

  group: function () {
    return this.belongsTo(Group)
  },

  user: function () {
    return this.belongsTo(User)
  },

  createdBy: function () {
    return this.belongsTo(User, 'created_by_id')
  },

  isLifted: function () {
    return !!this.get('lifted_at')
  }
}, {
  BANNED_ERROR,

  BANNED_REQUEST_ERROR,

  /**
   * Block someone from rejoining a group. Does nothing new when a block is
   * already in force, and returns that one.
   */
  async create ({ groupId, userId, createdById }, { transacting } = {}) {
    const existing = await GroupBan.active({ groupId, userId }, { transacting })
    if (existing) return existing
    try {
      return await new GroupBan({
        group_id: groupId,
        user_id: userId,
        created_by_id: createdById || null,
        created_at: new Date()
      }).save(null, { transacting })
    } catch (err) {
      // Someone else blocked the same person at the same moment: keep theirs
      if (err.code !== UNIQUE_VIOLATION || transacting) throw err
      return GroupBan.active({ groupId, userId })
    }
  },

  /** The block in force on this person in this group, if any. */
  active ({ groupId, userId }, { transacting } = {}) {
    if (!groupId || !userId) return Promise.resolve(null)
    return GroupBan.query(q => {
      q.where({ group_id: groupId, user_id: userId })
      q.whereNull('lifted_at')
    }).fetch({ transacting })
  },

  /**
   * Whether this person is blocked from joining this group: blocked from it,
   * or, for a space, from the group it belongs to.
   */
  async isBanned (userId, groupOrId, { transacting } = {}) {
    if (!userId || !groupOrId) return false
    const group = groupOrId instanceof Group ? groupOrId : await Group.find(groupOrId, { transacting })
    if (!group) return false
    const groupIds = [group.id, group.get('parent_id')].filter(Boolean)
    const row = await withTransaction(bookshelf.knex('group_bans')
      .where('user_id', userId)
      .whereIn('group_id', groupIds)
      .whereNull('lifted_at')
      .first('id'), transacting)
    return !!row
  },

  /** Refuse with BANNED_ERROR when this person is blocked from joining this group. */
  async assertNotBanned (userId, groupOrId, opts = {}) {
    if (await GroupBan.isBanned(userId, groupOrId, opts)) throw new GraphQLError(BANNED_ERROR)
  },

  /** Whether this person can see and lift the blocks in a group: anyone who can add or remove its members. */
  async canManage (userId, group) {
    if (!userId || !group) return false
    const { RESP_ADD_MEMBERS, RESP_REMOVE_MEMBERS } = Responsibility.constants
    return await GroupMembership.hasResponsibility(userId, group, RESP_ADD_MEMBERS) ||
      GroupMembership.hasResponsibility(userId, group, RESP_REMOVE_MEMBERS)
  },

  /** Lift the block in force on this person in this group. True when there was one. */
  async lift ({ groupId, userId, liftedById }, { transacting } = {}) {
    const count = await withTransaction(bookshelf.knex('group_bans')
      .where({ group_id: groupId, user_id: userId })
      .whereNull('lifted_at')
      .update({ lifted_at: new Date(), lifted_by_id: liftedById || null }), transacting)
    return count > 0
  },

  /**
   * The blocks in force in a group, newest first, with who was blocked and who
   * blocked them: only their id, name and avatar.
   */
  async listActive (groupId) {
    const rows = await bookshelf.knex('group_bans')
      .join('users as person', 'person.id', 'group_bans.user_id')
      .leftJoin('users as blocker', 'blocker.id', 'group_bans.created_by_id')
      .where('group_bans.group_id', groupId)
      .whereNull('group_bans.lifted_at')
      .orderBy('group_bans.created_at', 'desc')
      .orderBy('group_bans.id', 'desc')
      .select(
        'group_bans.id',
        'group_bans.created_at',
        'person.id as person_id',
        'person.name as person_name',
        'person.avatar_url as person_avatar_url',
        'blocker.id as blocker_id',
        'blocker.name as blocker_name',
        'blocker.avatar_url as blocker_avatar_url'
      )
    return rows.map(row => ({
      id: row.id,
      createdAt: row.created_at,
      person: { id: row.person_id, name: row.person_name, avatarUrl: row.person_avatar_url },
      createdBy: row.blocker_id
        ? { id: row.blocker_id, name: row.blocker_name, avatarUrl: row.blocker_avatar_url }
        : null
    }))
  }
})
