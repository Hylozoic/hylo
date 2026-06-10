import { useEffect, useState } from 'react'
import { createClient, fetchExchange } from 'urql'
import { authExchange } from '@urql/exchange-auth'
import { getIntrospectionQuery } from 'graphql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { devtoolsExchange } from '@urql/devtools'
// TODO: URQL - Switch to this from isomorphic-fetch on Web as well
import fetch from 'cross-fetch'
import apiHost from 'util/apiHost'
import { setSessionCookie } from 'util/session'
import { loadTokens, getCachedTokens, clearTokens, refreshAndSaveTokens } from 'util/tokenStore'
import { authLog, maskToken } from 'util/authDebug'
import keys from './keys'
import resolvers from './resolvers'
import optimistic from './optimistic'
import updates from './updates'
import directives from './directives'

export const GRAPHQL_ENDPOINT_URL = `${apiHost}/noo/graphql`

export async function fetchGraphqlSchema (endpoint) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: getIntrospectionQuery()
    })
  })
  const result = await response.json()

  return result.data
}

export default async function makeUrqlClient ({
  subscriptionExchange: providedSubscriptionExchange,
  schemaAwareness = false, // Off for now, creates lots of unexpected gaps in the app
  storage: providedStorageAdapter // this is platform dependent, so we need to pass it in
} = {}) {
  const schema = schemaAwareness && await fetchGraphqlSchema(GRAPHQL_ENDPOINT_URL)
  if (schema && process.env.NODE_ENV === 'development') {
    console.log('URQL Schema Awareness turned on')
  }

  const cache = cacheExchange({
    keys,
    resolvers,
    updates,
    optimistic,
    directives,
    schema,
    ...(providedStorageAdapter ? { storage: providedStorageAdapter } : {})
  })

  // Bearer token auth (mobile token-auth path). Attaches the Keychain access
  // token to every operation and refreshes it transparently. When no token is
  // present (e.g. the cookie-based signup flow), operations pass through
  // unchanged and rely on the session cookie as before.
  const auth = authExchange(async (utils) => {
    await loadTokens()

    const shouldRefresh = (tokens) =>
      tokens?.refresh_token && tokens?.expires_at && Date.now() > (tokens.expires_at - 60000)

    return {
      addAuthToOperation (operation) {
        const tokens = getCachedTokens()
        const opName = operation?.query?.definitions?.find(d => d.kind === 'OperationDefinition')?.name?.value
        if (!tokens?.access_token) {
          // No Bearer attached → this GraphQL request relies entirely on the
          // session cookie. On the iOS reopen bug this is the smoking gun.
          authLog(`urql op "${opName}": NO bearer (cookie-only)`)
          return operation
        }
        authLog(`urql op "${opName}": bearer ${maskToken(tokens.access_token)}`)
        return utils.appendHeaders(operation, {
          Authorization: `Bearer ${tokens.access_token}`
        })
      },
      willAuthError () {
        return shouldRefresh(getCachedTokens())
      },
      didAuthError (error) {
        return error?.response?.status === 401 ||
          error?.graphQLErrors?.some(e => e.extensions?.code === 'UNAUTHENTICATED')
      },
      async refreshAuth () {
        if (!getCachedTokens()?.refresh_token) return
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('🔑 urql authExchange: refreshing access token')
          }
          // Single-flight: shared with the WebView session bridge so the rotating
          // refresh token is never spent twice (which would revoke the grant).
          await refreshAndSaveTokens()
          if (process.env.NODE_ENV === 'development') {
            console.log('🔑 urql authExchange: token refresh succeeded ✓')
          }
        } catch (err) {
          // Only drop to logged-out on a genuine auth failure (the refresh token
          // is dead/revoked). Transient network/server errors (no 4xx status)
          // must NOT wipe the Keychain, or a brief blip logs the user out.
          const isAuthFailure = err.status >= 400 && err.status < 500
          if (process.env.NODE_ENV === 'development') {
            console.warn(`🔑 urql authExchange: token refresh failed (${isAuthFailure ? 'clearing Keychain tokens' : 'transient, keeping tokens'}):`, err.message)
          }
          if (isAuthFailure) await clearTokens()
        }
      }
    }
  })

  const client = createClient({
    exchanges: [
      devtoolsExchange,
      cache,
      auth,
      fetchExchange,
      providedSubscriptionExchange
    ].filter(Boolean), // Filter out undefined/null exchanges (e.g., when subscriptionExchange is not provided)
    fetch: async (...args) => {
      const response = await fetch(...args)

      const setCookieHeader = response.headers.get('set-cookie')
      if (setCookieHeader) {
        // Legacy behaviour: the backend refreshes the session cookie on (nearly)
        // every GraphQL response, and we persist it. Logging it lets us see how
        // much the app is still leaning on the cookie vs the Bearer token.
        authLog('urql fetch: response Set-Cookie present → persisting session cookie')
        await setSessionCookie(response)
      }

      return response
    },
    url: GRAPHQL_ENDPOINT_URL
  })

  // Graphcache debugging (verbose):
  // const { unsubscribe } = client.subscribeToDebugTarget(event => {
  //   if (event.source === 'cacheExchange') { return }
  //   // { type, message, operation, data, source, timestamp }
  //   console.log(event)
  // })

  return client
}

export function useMakeUrqlClient (options = {}) {
  const [urqlClient, setUrqlClient] = useState()

  useEffect(() => {
    (async () => {
      const client = await makeUrqlClient(options)
      setUrqlClient(client)
    })()
  }, [])

  return urqlClient
}
