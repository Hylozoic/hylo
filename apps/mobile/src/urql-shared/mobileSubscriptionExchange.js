import { subscriptionExchange } from 'urql'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'
import { GRAPHQL_ENDPOINT_URL } from './client'

export default subscriptionExchange({
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

        eventSource.addEventListener('next', (event) => {
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
