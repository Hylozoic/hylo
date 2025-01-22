import { isString, isObject } from 'lodash/fp'
import { useDispatch } from 'react-redux'
import { FETCH_GRAPHQL } from 'store/constants'

const usageError = new Error(
  'parameter is required, like: `graphqlAction(graphqlOperationOrReduxAction, optionalVariables)`'
)


export function fetchGraphqlAction ({ query, variables = {}, meta = {} }) {
  return {
    type: FETCH_GRAPHQL,
    graphql: {
      query,
      variables
    },
    meta
  }
}

export default function useGraphqlAction () {
  const dispatch = useDispatch()

  return async function graphqlAction (graphqlOperationOrReduxAction, variables = {}) {
    try {
      if (!graphqlOperationOrReduxAction) throw usageError

      let response

      if (
        isString(graphqlOperationOrReduxAction)
      ) {
        response = await dispatch(fetchGraphqlAction({
          query: graphqlOperationOrReduxAction,
          variables
        }))
      } else if (
        isObject(graphqlOperationOrReduxAction) &&
        Object.hasOwn(graphqlOperationOrReduxAction, 'definitions')
      ) {
        response = await dispatch(fetchGraphqlAction({
          query: graphqlOperationOrReduxAction,
          variables
        }))
      } else if (
        isObject(graphqlOperationOrReduxAction) &&
        Object.hasOwn(graphqlOperationOrReduxAction, 'type')
      ) {
        response = await dispatch(graphqlOperationOrReduxAction)
      }

      return response?.payload?.getData()
    } catch (e) {
      console.log('⛔️ `graphqlAction` error: ', e)
    }
  }
}
