import { graphqlToString } from 'util/graphql'

/**
 * GraphQL `errors[]` entries are plain objects. Rejecting them as-is becomes an
 * uncaught `Object` in the page, which hides the real `message`.
 */
function graphqlErrorFromPayload (raw) {
  if (raw instanceof Error) return raw
  const message = typeof raw?.message === 'string' ? raw.message : 'GraphQL error'
  const error = new Error(message)
  if (raw && typeof raw === 'object') Object.assign(error, raw)
  error.message = message
  return error
}

/**
 * True when the payload has at least one non-null data root (partial success).
 */
function hasGraphQLData (payload) {
  if (!payload?.data || typeof payload.data !== 'object') return false
  return Object.values(payload.data).some(value => value != null)
}

export default function graphqlMiddleware (store) {
  return next => action => {
    const { type, meta, graphql } = action

    if (!graphql) return next(action)

    const { query: unknownGraphql, variables = {} } = graphql
    const query = graphqlToString(unknownGraphql)
    const path = '/noo/graphql'
    const then = async payload => {
      // Field errors with a usable `data` payload are partial success (Apollo-style).
      // Rejecting them drops the group/post and leaves guests stuck on Loading / "Hylo".
      if (payload.errors && !hasGraphQLData(payload)) {
        return Promise.reject(graphqlErrorFromPayload(payload.errors[0]))
      }

      // Helper function for getting the results of the operation:
      // e.g. `payload.getData()` vs `payload.data.me` for a query
      // or `payload.data.myMutationName` for a mutation.
      const getData = () => {
        const dataRootKey = payload?.data && Object.keys(payload.data)[0]

        if (dataRootKey) {
          return payload.data[dataRootKey]
        }
      }
      const results = {
        ...payload,
        getData
      }

      // Enable `meta.then` continuation for this middleware
      return meta?.then
        ? meta.then(results)
        : results
    }

    return next({
      type,
      meta: {
        ...meta,
        graphql: { query, variables },
        then
      },
      payload: {
        api: {
          path,
          params: { query, variables },
          method: 'POST'
        }
      }
    })
  }
}
