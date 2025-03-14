import { subscriptionExchange } from 'urql'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'
import { GRAPHQL_ENDPOINT_URL } from '@hylo/urql/makeUrqlClient'

// Set to 0 for infinite retries, or a number to limit attempts
const MAX_RETRIES = 0
const BASE_RETRY_DELAY_MS = 1 * 1000
const RETRY_CAP_MS = 30 * 1000

let retryCount = 0
let isReconnecting = false
let globalEventSource = null

const resetRetryState = () => {
  retryCount = 0
  isReconnecting = false
}

const exponentialBackoff = (attempt) => Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), RETRY_CAP_MS)

const connectSubscription = (url, sink) => {
  console.log('Connecting graphql subscriptions...')

  globalEventSource = new EventSource(url.toString(), {
    withCredentials: true,
    credentials: 'include',
    method: 'GET',
    lineEndingCharacter: '\n'
  })

  globalEventSource.addEventListener('next', (event) => {
    try {
      const data = JSON.parse(event.data)
      sink.next(data)
      resetRetryState() // Reset retries on successful connection
    } catch (error) {
      console.error('Error parsing SSE message:', error)
    }
  })

  globalEventSource.addEventListener('error', (event) => {
    if (isReconnecting) return

    console.error('Subscription error:', event?.message || 'Unknown error')

    retryCount++
    isReconnecting = true

    globalEventSource.close()

    // Stop retrying if MAX_RETRIES is set and exceeded (unless it's 0 for infinite retries)
    if (MAX_RETRIES > 0 && retryCount >= MAX_RETRIES) {
      console.error('Max retries reached. No further attempts.')
      return
    }

    const retryDelay = exponentialBackoff(retryCount)
    console.log(`Retrying subscription in ${retryDelay / 1000} seconds...`)

    setTimeout(() => {
      isReconnecting = false
      connectSubscription(url, sink)
    }, retryDelay)
  })
}

export default subscriptionExchange({
  forwardSubscription: (operation) => {
    const url = new URL(GRAPHQL_ENDPOINT_URL)
    url.searchParams.append('query', operation.query)

    if (operation.variables) {
      url.searchParams.append('variables', JSON.stringify(operation.variables))
    }

    return {
      subscribe: (sink) => {
        connectSubscription(url, sink)

        return {
          unsubscribe: () => {
            if (globalEventSource) {
              console.log('Unsubscribing from SSE stream')
              globalEventSource.close()
            }
            resetRetryState()
          }
        }
      }
    }
  }
})
