// Limits on invitations sent with limited (Invite Members) access. Every valid
// address submitted counts, including ones skipped because that person is
// already a member or already invited, so the remaining allowance never shows
// which addresses were skipped.
const LIMITS = {
  perSend: 10,
  perInviterPerDay: 25,
  perGroupPerDay: 100
}

async function recipientsInLastDay (column, id, transacting) {
  let query = bookshelf.knex('invitation_sends')
    .where(column, id)
    .whereRaw("created_at > now() - interval '24 hours'")
    .sum('recipients as total')
    .first()
  if (transacting) query = query.transacting(transacting)
  const row = await query
  return Number(row?.total || 0)
}

async function advisoryLock (key, transacting) {
  await bookshelf.knex.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [key])
    .transacting(transacting)
}

module.exports = bookshelf.Model.extend({
  tableName: 'invitation_sends',
  requireFetch: false,

  user: function () {
    return this.belongsTo(User)
  },

  group: function () {
    return this.belongsTo(Group)
  }
}, {
  LIMITS,

  /**
   * How many more addresses this person can submit to this group in the next
   * send: the smaller of what is left of their own and of the group's daily limit.
   */
  remainingAllowance: async function ({ userId, groupId }, { transacting } = {}) {
    const byInviter = await recipientsInLastDay('user_id', userId, transacting)
    const byGroup = await recipientsInLastDay('group_id', groupId, transacting)
    return Math.max(0, Math.min(
      LIMITS.perInviterPerDay - byInviter,
      LIMITS.perGroupPerDay - byGroup
    ))
  },

  /**
   * Hold the group's and then the inviter's allowance until the transaction
   * ends, so concurrent sends cannot spend the same allowance twice. Taking
   * them in this order every time means two sends never wait on each other.
   */
  lockAllowance: async function ({ userId, groupId }, { transacting }) {
    await advisoryLock(`invite-allowance-group:${groupId}`, transacting)
    await advisoryLock(`invite-allowance-user:${userId}`, transacting)
  },

  record: async function ({ userId, groupId, recipients }, { transacting } = {}) {
    let query = bookshelf.knex('invitation_sends')
      .insert({ user_id: userId, group_id: groupId, recipients })
    if (transacting) query = query.transacting(transacting)
    await query
  }
})
