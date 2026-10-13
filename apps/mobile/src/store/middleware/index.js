import { createLogger } from 'redux-logger'
import { compact } from 'lodash'
import { isDev } from 'config'
import apiMiddleware from './apiMiddleware'
import promiseMiddleware from 'redux-promise'

const middleware = compact([
  apiMiddleware,
  promiseMiddleware,
  isDev &&
    createLogger({
      collapsed: (getState, action, logEntry) => !logEntry.error
    })
])

export default middleware
