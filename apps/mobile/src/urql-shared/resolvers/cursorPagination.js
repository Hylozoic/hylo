const cursorPagination = () => {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info

    const allFields = cache.inspectFields(entityKey)
    const fieldInfos = allFields.filter(info => info.fieldName === fieldName)
    const size = fieldInfos.length
    if (size === 0) {
      return undefined
    }

    const fieldKey = `${fieldName}(${JSON.stringify(fieldArgs)})`
    const isInTheCache = cache.resolve(entityKey, fieldKey)
    info.partial = !isInTheCache

    let inferredTypename = null
    let hasMore = false
    let total = 0
    const results = []
    fieldInfos.forEach((fi) => {
      const key = cache.resolve(entityKey, fi.fieldKey)
      if (!inferredTypename) {
        inferredTypename = cache.resolve(key, '__typename') // Introspect for typename
      }
      const data = cache.resolve(key, 'items')
      total = cache.resolve(key, 'total')
      const _hasMore = cache.resolve(key, 'hasMore')
      if (!hasMore) {
        hasMore = _hasMore
      }
      results.push(...(data || []))
    })

    // TODO: URQL - This re-ordering only seemed necessary to fix issues with the Messages list in a MessageThread,
    //       try removing it and testing later. It may not be necessary.
    const { order = 'desc' } = fieldArgs
    const isAscending = order.toLowerCase() === 'asc'
    const uniqueResults = [...new Set(results)].sort((a, b) => {
      const aCreatedAt = new Date(cache.resolve(a, 'createdAt') || 0).getTime()
      const bCreatedAt = new Date(cache.resolve(b, 'createdAt') || 0).getTime()
      return isAscending ? aCreatedAt - bCreatedAt : bCreatedAt - aCreatedAt
    })

    return {
      __typename: inferredTypename,
      items: uniqueResults,
      hasMore,
      total
    }
  }
}

export default cursorPagination
