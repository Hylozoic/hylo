import { createClient, fetchExchange, subscriptionExchange } from 'urql'
import { cacheExchange } from '@urql/exchange-graphcache'
import { devtoolsExchange } from '@urql/devtools'
import apiHost from 'util/apiHost'
import { setSessionCookie } from 'util/session'
import keys from './keys'
import resolvers from './resolvers'
import optimistic from './optimistic'
import updates from './updates'
import directives from './directives'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'

const GRAPHQL_ENDPOINT_URL = `${apiHost}/noo/graphql`

const cache = cacheExchange({
  keys,
  resolvers,
  updates,
  optimistic,
  directives
})

const client = createClient({
  exchanges: [
    devtoolsExchange,
    cache,
    fetchExchange,
    subscriptionExchange({
      forwardSubscription: (operation) => {
        const url = new URL(GRAPHQL_ENDPOINT_URL)

        url.searchParams.append('query', operation.query)

        if (operation.variables) {
          url.searchParams.append(
            'variables',
            JSON.stringify(operation.variables)
          )
        }

        return {
          subscribe: (sink) => {
            const eventSource = new EventSource(url.toString(), {
              withCredentials: true, // This is required for cookies
              credentials: 'include',
              method: 'GET',
              lineEndingCharacter: '\n'
            })

            eventSource.addEventListener('message', (event) => {
              const data = JSON.parse(event.data)

              sink.next(data)

              if (eventSource.readyState === 2) {
                sink.complete()
              }
            })

            eventSource.addEventListener('error', (event) => {
              if (event.type === 'error') {
                console.error('Connection error:', event?.message)
              } else if (event.type === 'exception') {
                console.error('Error:', event?.message, event?.error)
              }

              sink.error(event)
            })

            return {
              unsubscribe: () => eventSource.close()
            }
          }
        }
      }
    })
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
  url: GRAPHQL_ENDPOINT_URL
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
// export async function fetchGraphqlSchema (endpoint) {
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
//   const schema = await fetchGraphqlSchema(GRAPHQL_ENDPOINT_URL)
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
