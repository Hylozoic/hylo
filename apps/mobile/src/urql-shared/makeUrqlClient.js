import { createClient, fetchExchange } from 'urql'
import { getIntrospectionQuery } from 'graphql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { devtoolsExchange } from '@urql/devtools'
// TODO: Switch to this from isomorphic-fetch on Web as well
import fetch from 'cross-fetch'
import apiHost from 'util/apiHost'
import { setSessionCookie } from 'util/session'
import mobileSubscriptionExchange from './mobileSubscriptionExchange'
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

export default async function makeUrqlClient ({ schemaAwareness = false } = {}) {
  const schema = schemaAwareness && await fetchGraphqlSchema(GRAPHQL_ENDPOINT_URL)

  const cache = cacheExchange({
    keys,
    resolvers,
    updates,
    optimistic,
    directives,
    schema
  })

  const client = createClient({
    exchanges: [
      devtoolsExchange,
      cache,
      fetchExchange,
      mobileSubscriptionExchange
    ],
    fetch: async (...args) => {
      const response = await fetch(...args)

      if (response.headers.get('set-cookie')) {
        console.log('!!! setting cookie in urql fetch', response.headers.get('set-cookie'))
        await setSessionCookie(response)
      }

      return response
    },
    // Note: This didn't seem to change anything and can probably be removed
    fetchOptions: { credentials: 'include' },
    url: GRAPHQL_ENDPOINT_URL
  })

  // // Graphcache debugging:
  // const { unsubscribe } = client.subscribeToDebugTarget(event => {
  //   if (event.source === 'cacheExchange') { return }
  //   // { type, message, operation, data, source, timestamp }
  //   console.log(event)
  // })

  return client
}
