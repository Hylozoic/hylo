import { subscriptionExchange } from 'urql'
import { EventSource } from 'react-native-sse'
import { getSessionCookie } from '@hylo/shared'

export default subscriptionExchange({
  forwardSubscription: async operation => {
    const sessionCookie = await getSessionCookie()
    const headers = {}
    
    if (sessionCookie) {
      headers.Cookie = sessionCookie
    }

    const eventSource = new EventSource(operation.query, {
      headers
    })

    return {
      subscribe: sink => {
        const unsubscribe = eventSource.addEventListener('message', event => {
          const data = JSON.parse(event.data)
          sink.next(data)
        })

        eventSource.addEventListener('error', error => {
          sink.error(error)
        })

        return () => {
          unsubscribe()
          eventSource.close()
        }
      }
    }
  }
}) 