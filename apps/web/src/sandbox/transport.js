import { isTest } from 'config/index'
import { loadSandboxSeed } from './seed'
import { handleGraphql } from './handlers'

const MIN_DELAY_MS = 150
const MAX_DELAY_MS = 250

let seedPromise = null

/**
 * Load (once) and return the mutable in-memory sandbox seed.
 */
export function getSandboxSeed () {
  if (!seedPromise) {
    seedPromise = loadSandboxSeed()
  }
  return seedPromise
}

/**
 * Sandbox replacement for fetchJSON. Answers /noo/graphql from seed handlers
 * and stubs other /noo paths. Never hits the real API.
 */
export async function sandboxTransport (path, params, method = 'POST') {
  await delay()

  if (path === '/noo/graphql' || path?.endsWith('/noo/graphql')) {
    const seed = await getSandboxSeed()
    try {
      return handleGraphql(params || {}, seed)
    } catch (err) {
      console.error('[sandbox GraphQL]', err)
      return {
        errors: [{ message: err.message || 'Sandbox handler error' }]
      }
    }
  }

  if (path === '/noo/upload') {
    return {
      type: params?.type,
      id: params?.id,
      url: params?.url,
      filename: params?.filename
    }
  }

  if (path === '/noo/session') {
    return { success: true }
  }

  if (method.toLowerCase() === 'delete') {
    return { success: true }
  }

  return {}
}

function delay () {
  if (isTest) return Promise.resolve()
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)
  return new Promise(resolve => setTimeout(resolve, ms))
}
