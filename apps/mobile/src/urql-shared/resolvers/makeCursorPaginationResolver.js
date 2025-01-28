// Some reference points for this implementation:
// https://youtu.be/I6ypD7qv3Z8?t=26048
// https://github.com/benawad/lireddit/blob/28011261643e466bb9258acf1f5c335582639201/web/src/utils/createUrqlClient.ts#L34
// https://github.com/urql-graphql/urql/discussions/1066#discussioncomment-566519
// https://stackoverflow.com/questions/76012444/how-to-update-cache-with-pagination-and-sorting-urql-graphql

// A perhaps more complete implementation to evaluate:
// https://gist.github.com/austin43/ecd8d70e68d0571905f36b40d99fdf29#file-cursorpagination-ts

export default function makeCursorPaginationResolver () {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey, fieldName } = info
    const allFields = cache.inspectFields(parentKey)
    const fieldInfos = allFields.filter(info => info.fieldName === fieldName)
    const size = fieldInfos.length

    if (size === 0) {
      return undefined
    }

    const fieldKey = cache.keyOfField(fieldName, fieldArgs)
    const isInTheCache = cache.resolve(parentKey, fieldKey)
    info.partial = !isInTheCache

    let inferredTypename = null
    let items = []
    let hasMore = false
    let total = 0

    fieldInfos.forEach((fi) => {
      const key = cache.resolve(parentKey, fi.fieldKey)
      inferredTypename = cache.resolve(key, '__typename')
      items.push(...(cache.resolve(key, 'items') || []))
      hasMore = cache.resolve(key, 'hasMore')
      total = cache.resolve(key, 'total')
    })

    // TODO: URQL - This re-ordering only seemed necessary to fix issues with the Messages list in a MessageThread,
    //       try removing it and testing later. It may not be necessary.
    const { order = 'desc' } = fieldArgs
    const isAscending = order.toLowerCase() === 'asc'
    const uniqueItems = [...new Set(items)].sort((a, b) => {
      const aCreatedAt = new Date(cache.resolve(a, 'createdAt') || 0).getTime()
      const bCreatedAt = new Date(cache.resolve(b, 'createdAt') || 0).getTime()
      return isAscending ? aCreatedAt - bCreatedAt : bCreatedAt - aCreatedAt
    })

    return {
      __typename: inferredTypename,
      items: uniqueItems,
      hasMore,
      total
    }
  }
}
