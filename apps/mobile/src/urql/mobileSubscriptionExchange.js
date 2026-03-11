// DEPRECATED: This subscription exchange is no longer used.
// All real-time updates are now handled by the web app in the WebView.
// The only screen that used subscriptions (PostDetails) is deprecated.
// Kept for reference - may revisit if native screens are restored.
// Last used: 2025-01-28

/*
import { subscriptionExchange } from 'urql'
import EventSource from 'react-native-sse'
import { URL } from 'react-native-url-polyfill'
import { Platform } from 'react-native'
import { GRAPHQL_ENDPOINT_URL } from '@hylo/urql/makeUrqlClient'

// Set to 0 for infinite retries, or a number to limit attempts
const MAX_RETRIES = 0
const BASE_RETRY_DELAY_MS = 1 * 1000
const RETRY_CAP_MS = 30 * 1000
const subscriptionLoggingOn = process.env.NODE_ENV === 'development' && true // Flip this off if you don't want to see the logs

const exponentialBackoff = (attempt) => Math.min(BASE_RETRY_DELAY_MS * (2 ** attempt), RETRY_CAP_MS)

const connectSubscription = async (url, sink) => {
  // Extract query details for logging
  const queryText = url.searchParams.get('query')?.substring(0, 50) + '...'
  
  if (subscriptionLoggingOn) {
    console.log(`📱 [${Platform.OS.toUpperCase()}] Connecting graphql subscription for:`, queryText)
  }
  
  let retryCount = 0
  let isReconnecting = false
  let eventSource = null

  const resetRetryState = () => {
    retryCount = 0
    isReconnecting = false
  }

  const createConnection = async () => {
    eventSource = new EventSource(url.toString(), {
      withCredentials: true,
      credentials: 'include',
      method: 'GET',
      lineEndingCharacter: '\n',
    })

    eventSource.addEventListener('open', () => {
      if (subscriptionLoggingOn) {
        console.log(`📱 [${Platform.OS.toUpperCase()}] Subscription connection opened for:`, queryText)
      }
      resetRetryState()
    })

    eventSource.addEventListener('next', (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (subscriptionLoggingOn) {
          console.log(`📱 [${Platform.OS.toUpperCase()}] SSE received data:`, {
            type: data.type || data.event || 'unknown',
            keys: Object.keys(data),
            errors: data.errors,
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : null
          })
          
          if (data?.data?.allUpdates?.__typename === 'Post') {
            console.log(`📱 [${Platform.OS.toUpperCase()}] SSE received Post update:`, data.data.allUpdates.id)
          }
        }

        // Check for the specific "Subscription field must return Async Iterable" error
        if (data?.errors && data.errors.some(error => 
          error.message && error.message.includes('Subscription field must return Async Iterable')
        )) {
          console.error(`📱 [${Platform.OS.toUpperCase()}] Critical subscription error detected:`, data.errors)
          
          // Log additional details about the error
          if (process.env.NODE_ENV === 'development') {
            console.error(`📱 [${Platform.OS.toUpperCase()}] Error details:`, {
              errorCount: data.errors.length,
              firstError: data.errors[0],
              errorMessages: data.errors.map(e => e.message),
              errorPaths: data.errors.map(e => e.path),
              errorLocations: data.errors.map(e => e.locations)
            })
          }
          
          // Don't forward this error to the sink as it will cause issues
          // Instead, close the connection and let it retry
          handleConnectionError({ 
            message: 'Backend subscription configuration error - Async Iterable issue',
            isBackendError: true,
            errorDetails: data.errors
          })
          return
        }
        
        sink.next(data)
      } catch (error) {
        console.warn(`📱 [${Platform.OS.toUpperCase()}] Error parsing SSE message:`, error)
      }
    })

    eventSource.addEventListener('close', (event) => {
      if (subscriptionLoggingOn) {
        console.log(`📱 [${Platform.OS.toUpperCase()}] Subscription connection closed.`, JSON.stringify(event, null, 2))
      }
      // This event doesn't automatically mean an error, but in our case,
      // a close is unexpected, so we'll trigger the reconnection logic.
      handleConnectionError({ message: 'Connection closed unexpectedly' })
    })

    const handleConnectionError = (event) => {
      if (isReconnecting) return

      // console.warn(`📱 [${Platform.OS.toUpperCase()}] Subscription error. Full event:`, JSON.stringify(event, null, 2))
      console.warn(`📱 [${Platform.OS.toUpperCase()}] Query text:`, queryText)
      console.warn(`📱 [${Platform.OS.toUpperCase()}] Subscription error message:`, event?.message || 'Unknown error')

      // For backend configuration errors, use a longer delay to avoid overwhelming the server
      if (event?.isBackendError) {
        console.warn(`📱 [${Platform.OS.toUpperCase()}] Backend subscription error detected, using extended retry delay`)
        retryCount += 2 // Increment retry count more aggressively for backend errors
      } else {
        retryCount++
      }

      isReconnecting = true

      if (eventSource) {
        eventSource.close()
      }

      // Stop retrying if MAX_RETRIES is set and exceeded (unless it's 0 for infinite retries)
      if (MAX_RETRIES > 0 && retryCount >= MAX_RETRIES) {
        console.warn(`📱 [${Platform.OS.toUpperCase()}] Max retries reached. No further attempts.`)
        return
      }

      const retryDelay = exponentialBackoff(retryCount)
      if (subscriptionLoggingOn) {
        console.log(`📱 [${Platform.OS.toUpperCase()}] Retrying subscription for: ${queryText} in ${retryDelay / 1000} seconds...`)
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
          console.log(`📱 [${Platform.OS.toUpperCase()}] Unsubscribing from SSE stream for:`, queryText)
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
*/

// Export a no-op subscription exchange since the urql client still expects one
// This prevents any subscription attempts from erroring
export default null
