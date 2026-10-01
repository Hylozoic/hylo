function withTransaction (query, transacting) {
  return transacting ? query.transacting(transacting) : query
}

/**
 * Email addresses that asked for no more invitations, from the link in an
 * invitation email. Every invitation path leaves them out without saying so,
 * as it does for people already in the group.
 */
module.exports = bookshelf.Model.extend({
  tableName: 'invitation_opt_outs',
  requireFetch: false
}, {
  /** Record that this address wants no more invitations. Recording it again changes nothing. */
  record: async function ({ email, invitationId }, { transacting } = {}) {
    const address = String(email || '').trim().toLowerCase()
    if (!address) throw new Error('InvitationOptOut.record needs an email address')
    await withTransaction(bookshelf.knex('invitation_opt_outs')
      .insert({ email: address, invitation_id: invitationId || null, created_at: new Date() })
      .onConflict('email').ignore(), transacting)
  },

  /** Which of these addresses asked for no more invitations, lowercased. */
  optedOut: async function (emails, { transacting } = {}) {
    const addresses = [...new Set((emails || []).filter(Boolean).map(email => String(email).trim().toLowerCase()))]
    if (addresses.length === 0) return new Set()
    const rows = await withTransaction(bookshelf.knex('invitation_opt_outs')
      .whereIn('email', addresses)
      .select('email'), transacting)
    return new Set(rows.map(row => row.email))
  },

  isOptedOut: async function (email, opts) {
    return (await InvitationOptOut.optedOut([email], opts)).size > 0
  },

  /** For knex queries on group_invites: leaves out invitations to addresses that opted out. */
  whereNotOptedOut: function (qb, emailColumn = 'group_invites.email') {
    return qb.whereNotExists(function () {
      this.select(bookshelf.knex.raw(1)).from('invitation_opt_outs')
        .whereRaw(`invitation_opt_outs.email = lower(${emailColumn})`)
    })
  }
})
