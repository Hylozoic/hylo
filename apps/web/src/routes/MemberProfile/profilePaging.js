// Append ids from a query-set page, skipping ones already collected.
export function mergeIds (current, items) {
  const ids = current.slice()
  const seen = new Set(current)
  let added = 0
  ;(items || []).forEach(item => {
    if (!item || item.id == null) return
    const id = String(item.id)
    if (seen.has(id)) return
    seen.add(id)
    ids.push(id)
    added += 1
  })
  return { ids, added }
}

// Keep paging when the API says so, or when a full page of new rows arrived but hasMore was omitted.
// Stop when a page adds nothing, so a join that repeats the same rows cannot loop forever.
export function pageHasMore (querySet, added, pageSize) {
  if (!querySet || added < 1) return false
  if (querySet.hasMore) return true
  return (querySet.items || []).length >= pageSize
}

export function personFromResult (result) {
  const payload = result && result.payload
  if (!payload) return null
  if (typeof payload.getData === 'function') return payload.getData()
  return payload.data && payload.data.person
}
