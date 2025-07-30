import { subscriptionExchange } from 'urql'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'
import { GRAPHQL_ENDPOINT_URL } from '@hylo/urql/makeUrqlClient'
import { getSessionCookie } from 'util/session'

// Set to 0 for infinite retries, or a number to limit attempts
const MAX_RETRIES = 0
const BASE_RETRY_DELAY_MS = 1 * 1000
const RETRY_CAP_MS = 30 * 1000
const subscriptionLoggingOn = process.env.NODE_ENV === 'development' && true // Flip this off if you don't want to see the logs

const exponentialBackoff = (attempt) => Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), RETRY_CAP_MS)

const connectSubscription = async (url, sink) => {
  if (subscriptionLoggingOn) {
    console.log('Connecting graphql subscription for:', url.searchParams.get('query')?.substring(0, 50) + '...')
  }
  
  let retryCount = 0
  let isReconnecting = false
  let eventSource = null

  const resetRetryState = () => {
    retryCount = 0
    isReconnecting = false
  }

  const createConnection = async () => {
    // Get session cookie for authentication
    const sessionCookie = await getSessionCookie()
    
    const headers = {}
    if (sessionCookie) {
      headers.Cookie = sessionCookie
    }

    eventSource = new EventSource(url.toString(), {
      withCredentials: true,
      credentials: 'include',
      method: 'GET',
      lineEndingCharacter: '\n',
      headers
    })

    eventSource.addEventListener('open', () => {
      if (subscriptionLoggingOn) {
        console.log('Subscription connection opened for:', url.searchParams.get('query')?.substring(0, 50) + '...')
      }
      resetRetryState()
    })

    eventSource.addEventListener('next', (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (subscriptionLoggingOn) {
          console.log('📱 SSE received data:', {
            type: data.type || data.event || 'unknown',
            keys: Object.keys(data),
            errors: data.errors,
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : null
          })
          
          if (data?.data?.allUpdates?.__typename === 'Post') {
            console.log('📱 SSE received Post update:', data.data.allUpdates.id)
          }
        }
        
        sink.next(data)
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    })

    eventSource.addEventListener('close', (event) => {
      if (subscriptionLoggingOn) {
        console.log('Subscription connection closed.', JSON.stringify(event, null, 2))
      }
      // This event doesn't automatically mean an error, but in our case,
      // a close is unexpected, so we'll trigger the reconnection logic.
      handleConnectionError({ message: 'Connection closed unexpectedly' })
    })

    const handleConnectionError = (event) => {
      if (isReconnecting) return

      console.error('Subscription error. Full event:', JSON.stringify(event, null, 2))
      console.error('Subscription error message:', event?.message || 'Unknown error')

      retryCount++
      isReconnecting = true

      if (eventSource) {
        eventSource.close()
      }

      // Stop retrying if MAX_RETRIES is set and exceeded (unless it's 0 for infinite retries)
      if (MAX_RETRIES > 0 && retryCount >= MAX_RETRIES) {
        console.error('Max retries reached. No further attempts.')
        return
      }

      const retryDelay = exponentialBackoff(retryCount)
      if (subscriptionLoggingOn) {
        console.log(`Retrying subscription in ${retryDelay / 1000} seconds...`)
      }

      setTimeout(() => {
        isReconnecting = false
        createConnection()
      }, retryDelay)
    }

    eventSource.addEventListener('error', handleConnectionError)
  }

  await createConnection()

  return {
    unsubscribe: () => {
      if (eventSource) {
        if (subscriptionLoggingOn) {
          console.log('Unsubscribing from SSE stream')
        }
        eventSource.close()
      }
      resetRetryState()
    }
  }
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
        const connectionPromise = connectSubscription(url, sink)

        return {
          unsubscribe: async () => {
            const connection = await connectionPromise
            connection.unsubscribe()
          }
        }
      }
    }
  }
})
