//
// makePaginationResolver for URQL
//
// Loren Johnson 2025/02/29
//
// Handles both cursor and limit/offset-based pagination for Hylo QuerySet types
//
// This implementation simply adds the latest query result for the given parent.fieldName, assuming
// it is the latest result without regard for offset or cursor. This is potentially a naive
// implementation, but it should work reliably and consistently to dynamically assemble and return
// the full set of QuerySet.items available from the incoming query results + the cache, and ordered
// by the query designated arg for "order" which is assumed to be either "asc" or "desc". The ordering
// and deduping may both be unnecessary, but are kept for as a safeguard.
//
// Test cases for offset pagination -- imagine:
//
// 1) Result should skip cache and query:
//     posts(limit: 10 offset: 0 type: discussion, sortBy:updated)
//
// 2) Will query and then merge results with the results from step 1 (wash, repeat):
//     posts(limit: 10 offset: 0 type: discussion, sortBy:popular)
//
// Note: All field arguments are respected to make the unique cache key of each set, with the exceptions of our
// pagination-related keys which are filtered out (see PAGINATION_ARGS). So:
//     posts(limit: 10 offset: 40 type: discussion, sortBy:updated)
// will merge its results with all other cached posts fields with these keys:
//     posts(type:discussion,sortBy:updated).
//
// Some reference points for this implementation:
// https://gist.github.com/austin43/ecd8d70e68d0571905f36b40d99fdf29#file-cursorpagination-ts
// https://youtu.be/I6ypD7qv3Z8?t=26048
// https://github.com/benawad/lireddit/blob/28011261643e466bb9258acf1f5c335582639201/web/src/utils/createUrqlClient.ts#L34
// https://github.com/urql-graphql/urql/discussions/1066#discussioncomment-566519
// https://stackoverflow.com/questions/76012444/how-to-update-cache-with-pagination-and-sorting-urql-graphql
//
// And a UI way to handle pagination which doesn't work for React Native FlatList or SectionList, but could be useful on Web:
// https://gist.github.com/ryansukale/f217810e36dd697e319ce649d4624146
//

export const PAGINATION_ARGS = ['cursor', 'limit', 'offset', 'first']

const filterOutPaginationArgs = (args) => {
  return Object.fromEntries(
    Object.entries(args || {}).filter(([key]) => !PAGINATION_ARGS.includes(key))
  )
}

export default function makePaginationResolver ({ __typename } = {}) {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey, fieldName } = info

    // Step 1: Resolve current field's cached data, or return undefined to continue to fetching
    const fieldKey = cache.keyOfField(fieldName, fieldArgs)
    const cachedData = cache.resolve(parentKey, fieldKey)

    if (!cachedData) return undefined

    // Step 2: Find matching fields in the cache (excluding pagination args)
    const filteredFieldKey = cache.keyOfField(fieldName, filterOutPaginationArgs(fieldArgs || {}))
    const matchedFieldInfos = cache.inspectFields(parentKey).filter(candidateFieldInfo => {
      if (candidateFieldInfo.fieldName !== fieldName) return false
      const candidateFilteredFieldKey = cache.keyOfField(
        fieldName,
        filterOutPaginationArgs(candidateFieldInfo.arguments || {})
      )
      return candidateFilteredFieldKey === filteredFieldKey
    })

    // Step 3: Order matched fields by cursor or offset (ascending, but easily easily be made configurable)
    // Hasn't yet seemed necessary. Is setup to support both cursor and offset pagination.
    // matchedFieldInfos = matchedFieldInfos.sort((a, b) => {
    //   const aCursor = a.arguments?.cursor || a.arguments?.offset || 0
    //   const bCursor = b.arguments?.cursor || b.arguments?.offset || 0
    //   return aCursor + bCursor
    // })

    // Step 4: Aggregate data from matched fields and include the current field's cached data
    let items = []
    let hasMore = false
    let total = 0
    let __inferredTypename = null
    // merge all items together in sequence of page matches
    matchedFieldInfos.forEach(fieldInfo => {
      const key = cache.resolve(parentKey, fieldInfo.fieldKey)

      if (!key) return

      const newItems = cache.resolve(key, 'items')

      if (!newItems) return

      items = [...items, ...newItems]
      hasMore = cache.resolve(key, 'hasMore')
      total = cache.resolve(key, 'total')
      __inferredTypename = cache.resolve(key, '__typename')
    })

    // Step 5: Ensure items are deduplicated, not yet prove necessary but here as safeguard
    const uniqueItems = [...new Set(items)]

    return {
      __typename: __typename || __inferredTypename,
      items: uniqueItems,
      hasMore,
      total
    }
  }
}
