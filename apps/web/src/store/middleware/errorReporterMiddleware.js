import errorReporter, { addBreadcrumb, SENTRY_DEBUG } from 'client/errorReporter'

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
      errorReporter.error(describeActionError(type, payload), {
        action: JSON.parse(safeStringify(action))
      })
    }
    return next(action)
  }
}

/**
 * Builds a Sentry-friendly message from a failed redux action payload.
 * GraphQL failures often arrive as Error instances (message/path) or HTTP
 * errors with response.body; Error.message is non-enumerable so we read it
 * directly rather than relying on JSON serialization of the action alone.
 */
export function describeActionError (type, payload) {
  let errMsg = `action error for ${type}`
  const parts = []

  const message = typeof payload?.message === 'string' ? payload.message : null
  const path = Array.isArray(payload?.path) ? payload.path : null
  const responseBody = payload?.response?.body

  if (message && message !== responseBody) {
    parts.push(message)
  }
  if (path?.length) {
    parts.push(`path: ${path.join('.')}`)
  }
  if (responseBody != null && responseBody !== '') {
    parts.push(typeof responseBody === 'string' ? responseBody : String(responseBody))
  }

  if (parts.length) errMsg += `: ${parts.join(' | ')}`
  return errMsg
}

/**
 * JSON.stringify that preserves Error name/message/stack (normally dropped
 * because those properties are non-enumerable) and skips circular refs.
 */
export function safeStringify (obj) {
  const cache = []

  return JSON.stringify(obj, function (key, value) {
    if (value instanceof Error) {
      const serialized = {
        name: value.name,
        message: value.message,
        stack: value.stack
      }
      for (const ownKey of Object.keys(value)) {
        serialized[ownKey] = value[ownKey]
      }
      return serialized
    }
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
        return
      }
      cache.push(value)
    }
    return value
  })
}
