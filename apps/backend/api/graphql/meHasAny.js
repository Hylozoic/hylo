/* global bookshelf */

// Lightweight "has any" checks behind Me.hasTracks, Me.hasFundingRounds,
// Me.hasTransactions and Me.hasSavedSearches. The My Home menu greys out the
// items that would open an empty page, so each check stops at the first row.

function exists (query) {
  return query.select(bookshelf.knex.raw('1')).first().then(row => Boolean(row))
}

// Tracks and funding rounds are spaces: groups with a track_id or funding_round_id
function hasActiveSpaceMembershipWith (userId, column) {
  if (!userId) return Promise.resolve(false)
  return exists(
    bookshelf.knex('group_memberships')
      .join('groups', 'groups.id', 'group_memberships.group_id')
      .where('group_memberships.user_id', userId)
      .where('group_memberships.active', true)
      .where('groups.active', true)
      .whereNotNull(`groups.${column}`)
  )
}

export function hasTracks (userId) {
  return hasActiveSpaceMembershipWith(userId, 'track_id')
}

export function hasFundingRounds (userId) {
  return hasActiveSpaceMembershipWith(userId, 'funding_round_id')
}

// Same rows My Transactions lists: purchases, not access granted by a steward
export function hasTransactions (userId) {
  if (!userId) return Promise.resolve(false)
  return exists(
    bookshelf.knex('content_access')
      .where({ user_id: userId, access_type: 'stripe_purchase' })
  )
}

export function hasSavedSearches (userId) {
  if (!userId) return Promise.resolve(false)
  return exists(
    bookshelf.knex('saved_searches')
      .where({ user_id: userId, is_active: true })
  )
}
