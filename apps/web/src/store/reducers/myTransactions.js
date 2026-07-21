/**
 * MyTransactions Reducer
 *
 * Stores raw transaction data from the API since transactions
 * are not ORM models and can't use the standard queryResults pattern.
 */

import { get } from 'lodash/fp'
import {
  FETCH_MY_TRANSACTIONS,
  APPLY_OPTIMISTIC_MEMBERSHIP_CHANGE
} from 'store/actions/fetchMyTransactions'

const initialState = {
  items: [],
  total: 0,
  hasMore: false,
  pending: false,
  error: null
}

export default function myTransactionsReducer (state = initialState, action) {
  const { type, payload, error } = action

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

  if (type === APPLY_OPTIMISTIC_MEMBERSHIP_CHANGE) {
    const {
      groupId,
      fromOfferingId,
      toOffering,
      amountPaid,
      currency
    } = payload || {}
    if (!groupId || !fromOfferingId || !toOffering) {
      return state
    }
    const items = state.items.map(item => {
      const groupMatches =
        item.group?.id != null && String(item.group.id) === groupId
      const fromMatches =
        item.offering?.id != null &&
        String(item.offering.id) === fromOfferingId
      const isSubscription = item.paymentType === 'subscription'
      if (!groupMatches || !fromMatches || !isSubscription) {
        return item
      }
      const nextCurrency = currency || item.currency
      return {
        ...item,
        offeringName: toOffering.name ?? item.offeringName,
        offering: {
          ...(item.offering || {}),
          id: toOffering.id,
          name: toOffering.name,
          duration: toOffering.duration ?? item.offering?.duration,
          priceInCents:
            toOffering.priceInCents ?? item.offering?.priceInCents
        },
        ...(amountPaid != null ? { amountPaid } : {}),
        ...(currency ? { currency: nextCurrency } : {})
      }
    })
    return { ...state, items }
  }

  return state
}

/**
 * Selector to get transactions from state
 */
export function getMyTransactions (state) {
  return state.myTransactions || initialState
}
