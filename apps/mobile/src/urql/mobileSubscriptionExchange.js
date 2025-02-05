import { subscriptionExchange } from 'urql'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'
import { GRAPHQL_ENDPOINT_URL } from '@hylo/urql/makeUrqlClient'

const MAX_RETRIES = 5
const BASE_RETRY_DELAY = 1000 // 1 second
const RETRY_CAP = 30000 // Max delay of 30 seconds

let retryCount = 0
let isReconnecting = false
let globalEventSource = null

const resetRetryState = () => {
  retryCount = 0
  isReconnecting = false
}

const exponentialBackoff = (attempt) => Math.min(BASE_RETRY_DELAY * (2 ** attempt), RETRY_CAP)

const connectSubscription = (url, sink) => {
  if (retryCount >= MAX_RETRIES) {
    console.error('Max retries reached. No further attempts.')
    return
  }

  console.log(`Connecting subscription... (Retry #${retryCount})`)

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
