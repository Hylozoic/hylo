import { createLogger } from 'redux-logger'
import { compact } from 'lodash'
import { isDev } from 'config'
import apiMiddleware from './apiMiddleware'
import graphQLMiddleware from './graphqlMiddleware'
import promiseMiddleware from 'redux-promise'
import userFetchedMiddleware from './userFetchedMiddleware'
import groupFetchedMiddleware from './groupFetchedMiddleware'
import mixpanelMiddleware from './mixpanelMiddleware'

const middleware = compact([
  graphQLMiddleware,
  apiMiddleware,
  promiseMiddleware,
  userFetchedMiddleware,
  groupFetchedMiddleware,
  mixpanelMiddleware,
  isDev &&
    createLogger({
      collapsed: (getState, action, logEntry) => !logEntry.error
    })
])

export default middleware
