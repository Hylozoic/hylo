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

    let hasMore = false
    let total = 0
    const results = []
    fieldInfos.forEach((fi) => {
      const key = cache.resolve(entityKey, fi.fieldKey)
      const data = cache.resolve(key, 'items')
      total = cache.resolve(key, 'total')
      const _hasMore = cache.resolve(key, 'hasMore')
      if (!hasMore) {
        hasMore = _hasMore
      }
      results.push(...(data || []))
    })
    return {
      // TODO: introspect for this!
      __typename: 'CommentQuerySet',
      items: results,
      hasMore,
      total
    }
  }
}

export default cursorPagination
