export default function makeOffsetPaginationResolver ({ offsetArg = 'offset', limitArg = 'first' } = {}) {
  return (parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info
    const allFields = cache.inspectFields(entityKey)
    const fieldInfos = allFields.filter(
      (info) => info.fieldName === fieldName
    )

    if (fieldInfos.length === 0) {
      return undefined
    }

    let inferredTypename = null
    // cache.resolve(entityKey, fieldInfos[0].fieldKey)
    let items = []
    let hasMore = true
    let total = 0

    fieldInfos.forEach((fi) => {
      const key = cache.resolve(entityKey, fi.fieldKey)
      inferredTypename = cache.resolve(key, '__typename')
      const newItems = cache.resolve(key, 'items') || []
      const _hasMore = cache.resolve(key, 'hasMore')
      const _total = cache.resolve(key, 'total')

      if (_hasMore === false) {
        hasMore = false
      }

      total = _total
      items = [...items, ...newItems]
    })

    // Remove duplicates
    items = Array.from(new Set(items))

    // Sort items if they have a 'createdAt' field
    if (items.length > 0 && cache.resolve(items[0], 'createdAt')) {
      items.sort((a, b) => {
        const dateA = new Date(cache.resolve(a, 'createdAt'))
        const dateB = new Date(cache.resolve(b, 'createdAt'))
        return dateB - dateA
      })
    }

    return {
      __typename: inferredTypename,
      items,
      hasMore,
      total
    }
  }
}
