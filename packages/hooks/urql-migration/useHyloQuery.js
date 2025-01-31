import { isString, isObject, isFunction } from 'lodash/fp'
import { useState, useEffect, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import useDeepCompareMemoize from './useDeepCompareMemoize'
import { fetchGraphqlActionCreator } from './useGraphqlAction'

const usageError = new Error(
  'A value for either "query" or "action" is required'
)

const onlyQueryOrActionError = new Error(
  'Only one of "query" or "action" can be provided'
)

const invalidQueryOrActionError = new Error(
  'The provided "query" or "action" must be either an action or action creator function or a GraphQL operation or string'
)

const noDataError = new Error(
  'No data was returned from the provided GraphQL query or action.'
)

export default function useHyloQuery ({ query, action, variables, meta, pause }) {
  const dispatch = useDispatch()
  const [data, setData] = useState(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState(null)

  // Memoize the dependencies using deep comparison
  const memoizedQuery = useDeepCompareMemoize(query)
  const memoizedAction = useDeepCompareMemoize(action)
  const memoizedVariables = useDeepCompareMemoize(variables)
  const memoizedMeta = useDeepCompareMemoize(meta)

  const executeQuery = useCallback(async () => {
    try {
      if (!memoizedQuery && !memoizedAction) {
        throw usageError
      }

      if (memoizedQuery && memoizedAction) {
        throw onlyQueryOrActionError
      }

      let response

      // Redux Action Creator (with or without params)
      if (isFunction(memoizedAction)) {
        if (memoizedVariables || memoizedMeta) {
          response = await dispatch(memoizedAction({
            variables: memoizedVariables || {},
            meta: memoizedMeta || {}
          }))
        } else {
          response = await dispatch(memoizedAction())
        }
      // Redux Action
      } else if (isObject(memoizedAction) && Object.hasOwnProperty.call(memoizedAction, 'type')) {
        response = await dispatch(memoizedAction)
      // GraphQL query string or operation object (the result of using the `gql` tag)
      } else if (
        isString(memoizedQuery) ||
        (isObject(memoizedQuery) && Object.hasOwnProperty.call(memoizedQuery, 'definitions'))
      ) {
        response = await dispatch(fetchGraphqlActionCreator({
          query: memoizedQuery,
          variables: memoizedVariables || {},
          meta: memoizedMeta || {}
        }))
      } else {
        throw invalidQueryOrActionError
      }

      if (response?.payload?.getData() === null) {
        throw noDataError
      }

      setData(response?.payload?.data)
    } catch (e) {
      setError(e)
    } finally {
      setFetching(false)
    }
  }, [dispatch, memoizedQuery, memoizedAction, memoizedVariables, memoizedMeta])

  useEffect(() => {
    if (!pause) {
      executeQuery()
    }
  }, [pause, executeQuery])

  return [{ data, fetching, error }, executeQuery]
}
