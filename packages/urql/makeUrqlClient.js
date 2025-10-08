import { useEffect, useState } from 'react'
import { createClient, fetchExchange } from 'urql'
import { getIntrospectionQuery } from 'graphql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { devtoolsExchange } from '@urql/devtools'
// TODO: URQL - Switch to this from isomorphic-fetch on Web as well
import fetch from 'cross-fetch'
import apiHost from 'util/apiHost'
import { setSessionCookie } from 'util/session'
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

  const client = createClient({
    exchanges: [
      devtoolsExchange,
      cache,
      fetchExchange,
      providedSubscriptionExchange
    ],
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
