/**
 * MyTransactions Reducer
 *
 * Stores raw transaction data from the API since transactions
 * are not ORM models and can't use the standard queryResults pattern.
 */

import { get } from 'lodash/fp'
import { FETCH_MY_TRANSACTIONS } from 'store/actions/fetchMyTransactions'

const initialState = {
  items: [],
  total: 0,
  hasMore: false,
  pending: false,
  error: null
}

export default function myTransactionsReducer (state = initialState, action) {
  const { type, payload, error, meta } = action

  // Handle pending state (dispatched by pendingMiddleware)
  if (type === `${FETCH_MY_TRANSACTIONS}_PENDING`) {
    return {
      ...state,
      pending: true,
      error: null
    }
  }

  if (type === FETCH_MY_TRANSACTIONS) {
    // Handle error
    if (error) {
      return {
        ...state,
        pending: false,
        error: payload?.message || 'Failed to fetch transactions'
      }
    }

    // Handle success
    const data = get('data.myTransactions', payload)
    if (data) {
      return {
        items: data.items || [],
        total: data.total || 0,
        hasMore: data.hasMore || false,
        pending: false,
        error: null
      }
    }
  }

  return state
}

/**
 * Selector to get transactions from state
 */
export function getMyTransactions (state) {
  return state.myTransactions || initialState
}
