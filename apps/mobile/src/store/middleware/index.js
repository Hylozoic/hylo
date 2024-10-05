import { createLogger } from 'redux-logger'
import { compact } from 'lodash'
import { isDev } from 'config'
import afterInteractionsMiddleware from './afterInteractions'
import apiMiddleware from './apiMiddleware'
import graphQLMiddleware from './graphqlMiddleware'
import optimisticMiddleware from './optimisticMiddleware'
import pendingMiddleware from './pendingMiddleware'
import promiseMiddleware from 'redux-promise'
import userFetchedMiddleware from './userFetchedMiddleware'
import groupFetchedMiddleware from './groupFetchedMiddleware'
import userBlockingMiddleware from './userBlockingMiddleware'
import mixpanelMiddleware from './mixpanelMiddleware'

const middleware = compact([
  graphQLMiddleware,
  apiMiddleware,
  afterInteractionsMiddleware,
  optimisticMiddleware,
  pendingMiddleware,
  promiseMiddleware,
  userFetchedMiddleware,
  groupFetchedMiddleware,
  userBlockingMiddleware,
  mixpanelMiddleware,
  isDev &&
    createLogger({
      collapsed: (getState, action, logEntry) => !logEntry.error
    })
])

export default middleware
