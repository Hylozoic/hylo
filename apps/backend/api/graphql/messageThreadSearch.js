/**
 * Builds a case-insensitive ILIKE pattern for substring matching.
 */
export function ilikeContainsPattern (term) {
  const escaped = term.trim()
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
  return `%${escaped}%`
}

/**
 * Restricts a message thread query to threads whose other participants' names
 * or message text match the search term (case-insensitive).
 */
export function applyMessageThreadSearch (q, userId, search) {
  const term = search && search.trim()
  if (!term) return q

  const pattern = ilikeContainsPattern(term)

  return q.where(function () {
    this.whereExists(function () {
      this.select(bookshelf.knex.raw('1'))
        .from('posts_users as pu')
        .join('users as u', 'u.id', 'pu.user_id')
        .whereRaw('pu.post_id = posts.id')
        .where({
          'pu.active': true,
          'pu.following': true
        })
        .where('u.id', '!=', userId)
        .whereRaw('u.name ilike ?', [pattern])
    })
      .orWhereExists(function () {
        this.select(bookshelf.knex.raw('1'))
          .from('comments as c')
          .whereRaw('c.post_id = posts.id')
          .where('c.active', true)
          .whereRaw('c.text ilike ?', [pattern])
      })
  })
}

/**
 * GraphQL relation filter for messageThreads search.
 */
export const messageThreadSearchFilter = userId => (relation, { search } = {}) => {
  if (!search || !search.trim()) return relation
  return relation.query(q => applyMessageThreadSearch(q, userId, search))
}
