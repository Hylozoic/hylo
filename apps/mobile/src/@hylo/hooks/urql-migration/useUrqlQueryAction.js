import { isString, isObject, isFunction } from 'lodash/fp'
import { useState, useEffect, useCallback } from 'react'
import useDeepCompareMemoize from './useDeepCompareMemoize'
import { fetchGraphqlAction } from './useGraphqlAction'
import { useClient } from 'urql'
import { useDispatch } from 'react-redux'

const usageError = new Error(
  'A value for either "query" or "action" is required'
)

const onlyQueryOrActionError = new Error(
  'Only one of "query" or "action" can be provided'
)

const invalidQueryOrActionError = new Error(
  'The provided "query" or "action" must be either an action or action creator function or a GraphQL operation or string'
)

const noQueryAction = new Error(
  'No queryAction was returned from the provided GraphQL query or action.'
)

export default function useUrqlQueryAction ({ query, action, variables, meta, pause, operationContext }) {
  const dispatch = useDispatch()
  const client = useClient()
  const [queryAction, setQueryAction] = useState()
  const [response, setResponse] = useState([{}, null])
  const [loading, setLoading] = useState(null)

  // Memoize the dependencies using deep comparison
  const memoizedQuery = useDeepCompareMemoize(query)
  const memoizedAction = useDeepCompareMemoize(action)
  const memoizedVariables = useDeepCompareMemoize(variables)
  const memoizedMeta = useDeepCompareMemoize(meta)

  const getQueryAction = useCallback(() => {
    if (!memoizedQuery && !memoizedAction) {
      throw usageError
    }

    if (memoizedQuery && memoizedAction) {
      throw onlyQueryOrActionError
    }

    let queryAction

    // Redux Action Creator (with or without params)
    if (isFunction(memoizedAction)) {
      if (memoizedVariables || memoizedMeta) {
        queryAction = memoizedAction({
          variables: memoizedVariables || {},
          meta: memoizedMeta || {}
        })
      } else {
        queryAction = memoizedAction()
      }
    // Redux Action
    } else if (isObject(memoizedAction) && Object.hasOwnProperty.call(memoizedAction, 'type')) {
      queryAction = memoizedAction
    // GraphQL query string or operation object (the result of using the `gql` tag)
    } else if (
      isString(memoizedQuery) ||
      (isObject(memoizedQuery) && Object.hasOwnProperty.call(memoizedQuery, 'definitions'))
    ) {
      queryAction = fetchGraphqlActionCreator({
        query: memoizedQuery,
        variables: memoizedVariables || {},
        meta: memoizedMeta || {}
      })
    } else {
      throw invalidQueryOrActionError
    }

    if (queryAction === null) {
      throw noQueryAction
    }

    setQueryAction(queryAction)
  }, [memoizedQuery, memoizedAction, memoizedVariables, memoizedMeta])

  useEffect(() => {
    getQueryAction()
    // Start in loading state if query execution isn't deferred
    setLoading(!pause)
  }, [getQueryAction])

  useEffect(() => {
    (async function () {
      const executeQuery = (variables = {}) => {
        return client.query(
          queryAction?.graphql?.query,
          { ...queryAction?.graphql?.variables, ...variables } || {},
          operationContext || {}
        )
      }
      if (!pause && queryAction) {
        setLoading(true)

        const urqlResponse = await executeQuery()

        if (urqlResponse?.data && queryAction?.meta) {
          const { data } = urqlResponse
          await dispatch({
            type: 'EXTRACT_GRAPHQL_RESULT_TO_REDUX_ORM',
            meta: {
              ...queryAction.meta,
              graphql: {
                variables: queryAction.graphql?.variables
              }
            },
            payload: {
              // Helper function for getting the results of the operation:
              // e.g. `payload.getData()` vs `payload.data.me` for a query
              // or `payload.data.myMutationName` for a mutation.
              getData: () => {
                const dataRootKey = data && Object.keys(data)[0]

                if (dataRootKey) {
                  return data[dataRootKey]
                }
              },
              data
            }
          })
          setResponse([urqlResponse, executeQuery])
          setLoading(false)
        }
      }
    })()
  }, [pause, queryAction?.graphql?.query, queryAction?.graphql?.variables])

  return [{ ...response[0], fetching: loading }, response[1]]
}
