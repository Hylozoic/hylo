import { isString, isObject } from 'lodash/fp'
import { useDispatch } from 'react-redux'
import fetchGraphQLAction from 'store/actions/fetchGraphQL'

const usageError = new Error(
  'parameter is required, like: `graphqlAction(graphqlOperationOrReduxAction, optionalVariables)`'
)

export default function useGraphqlAction () {
  const dispatch = useDispatch()

  return async function graphqlAction (graphqlOperationOrReduxAction, variables = {}) {
    try {
      if (!graphqlOperationOrReduxAction) throw usageError

      let response

      if (
        isString(graphqlOperationOrReduxAction)
      ) {
        response = await dispatch(fetchGraphQLAction({
          query: graphqlOperationOrReduxAction,
          variables
        }))
      } else if (
        isObject(graphqlOperationOrReduxAction) &&
        Object.hasOwn(graphqlOperationOrReduxAction, 'definitions')
      ) {
        response = await dispatch(fetchGraphQLAction({
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
