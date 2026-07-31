import { castArray, has } from 'lodash'

/** Restrict member queries to real profiles (not system, deleted, or incomplete accounts). */
export function applyVisibleMemberUserFilters (q) {
  q.where('users.id', '!=', User.AXOLOTL_ID)
  q.whereNotNull('users.name')
  q.where('users.name', '!=', '')
  q.where('users.name', '!=', 'Deleted User')
}

// handle a single entity or a list of entity or ids; do nothing if no ids or
// entities are passed
export function whereId (q, objectsOrIds, columnName) {
  if (!objectsOrIds) return
  const ids = castArray(objectsOrIds).map(x => has(x, 'id') ? x.id : x)
  if (ids.length > 1) {
    q.where(columnName, 'in', ids)
  } else if (ids.length > 0) {
    q.where(columnName, ids[0])
  }
}
