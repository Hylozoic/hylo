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
import { loadTokens, getCachedTokens, saveTokens, clearTokens } from 'util/tokenStore'
import { refreshTokens } from 'util/authApi'
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
        if (!tokens?.access_token) return operation
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
        const tokens = getCachedTokens()
        if (!tokens?.refresh_token) return
        try {
          const refreshed = await refreshTokens(tokens.refresh_token)
          await saveTokens({ ...tokens, ...refreshed })
        } catch (err) {
          // Refresh token is dead — clear so the app drops to the logged-out state.
          await clearTokens()
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

      if (response.headers.get('set-cookie')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('!!! setting cookie in urql fetch', response.headers.get('set-cookie'))
        }
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
