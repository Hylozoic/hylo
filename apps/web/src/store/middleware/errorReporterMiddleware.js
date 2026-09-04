import errorReporter, { addBreadcrumb, SENTRY_DEBUG } from 'client/errorReporter'
import { get } from 'lodash/fp'

/*
  Reports redux action errors to Sentry. When VITE_SENTRY_DEBUG=true it also
  leaves a breadcrumb for every dispatched action, so error reports from
  staging/review builds include a trail of what the app was doing.
*/
export default function errorReporterMiddleware (store) {
  return next => action => {
    const { error, type, payload } = action
    if (SENTRY_DEBUG) {
      addBreadcrumb({ category: 'redux', message: type, level: error ? 'error' : 'info' })
    }
    if (error) {
      let errMsg = `action error for ${type}`
      const serverMessage = get('response.body', payload)
      if (serverMessage) errMsg += `: ${serverMessage}`
      errorReporter.error(errMsg, { action: JSON.parse(safeStringify(action)) })
    }
    return next(action)
  }
}

const safeStringify = (obj) => {
  let cache = []

  const stringified = JSON.stringify(obj, function (key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return
      }
      cache.push(value)
    }
    return value
  })
  cache = null

  return stringified
}
