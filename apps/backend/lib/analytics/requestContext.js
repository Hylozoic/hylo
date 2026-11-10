import { AsyncLocalStorage } from 'async_hooks'

const storage = new AsyncLocalStorage()

/** Runs `fn` with the current request's platform available to event writers. */
export function runWithRequestContext (context, fn) {
  return storage.run(context, fn)
}

/** 'web', 'ios' or 'android' for the request in progress, or null outside one. */
export function currentPlatform () {
  const context = storage.getStore()
  return context ? context.platform : null
}
