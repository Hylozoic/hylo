import { createClient, fetchExchange } from 'urql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { devtoolsExchange } from '@urql/devtools'
import apiHost from 'util/apiHost'
import keys from './keys'
import resolvers from './resolvers'
import optimistic from './optimistic'
import updates from './updates'
import { setSessionCookie } from 'util/session'

const GRAPHQL_ENDPOINT_URL = `${apiHost}/noo/graphql`

const cache = cacheExchange({
  keys,
  resolvers,
  updates,
  optimistic
})

const client = createClient({
  exchanges: [
    devtoolsExchange,
    cache,
    fetchExchange
  ],
  fetch: async (...args) => {
    const response = await fetch(...args)

    if (response.headers.get('set-cookie')) {
      console.log('!!! setting cookie in urql fetch', response.headers.get('set-cookie'))
      await setSessionCookie(response)
    }

    return response
  },
  fetchOptions: { credentials: 'include' },
  url: GRAPHQL_ENDPOINT_URL,
})

export default client

// Optional logging for debugging
// const { unsubscribe } = client.subscribeToDebugTarget(event => {
//   if (event.source === 'cacheExchange') { return }
//   // { type, message, operation, data, source, timestamp }
//   console.log(event)
// })

// Optional: Scheme introspection. Turned off for now to reduce complexity and initial load time.
// import { getIntrospectionQuery } from 'graphql'
// TODO: Switch to this from isomorphic-fetch on Web as well
// import fetch from 'cross-fetch'
//
// export async function fetchGraphQLSchema (endpoint) {
//   const response = await fetch(endpoint, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       query: getIntrospectionQuery()
//     })
//   })
//   const result = await response.json()

//   return result.data
// }

// export async function setupUrqlClient () {
//   const schema = await fetchGraphQLSchema(GRAPHQL_ENDPOINT_URL)
//   const cache = cacheExchange({
//     keys,
//     resolvers,
//     updates,
//     optimistic,
//     schema
//   })

//   const client = createClient({
//     url: GRAPHQL_ENDPOINT_URL,
//     exchanges: [devtoolsExchange, throwOnErrorExchange(), cache, fetchExchange]
//   })

//   return client
// }

// export default setupUrqlClient
