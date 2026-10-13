import React, { useEffect } from 'react'
import { useClient } from 'urql'

/**
 * Development diagnostic to monitor URQL cache behavior
 * This helps understand when partial data is returned from the cache
 */
export default function UrqlCacheDiagnostic () {
  const client = useClient()

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let unsubscribe = null

    // Check if debug target subscription is available
    if (client.subscribeToDebugTarget && typeof client.subscribeToDebugTarget === 'function') {
      try {
        unsubscribe = client.subscribeToDebugTarget(event => {
          // Filter for cache-related events
          if (event.source === 'cacheExchange') {
            // Log when cache returns partial data
            if (event.type === 'cacheHit' && event.data) {
              const hasPartialData = checkForPartialData(event.data)
              if (hasPartialData) {
                console.warn('🔍 URQL Cache returned partial data:', {
                  operation: event.operation?.query?.definitions?.[0]?.name?.value,
                  variables: event.operation?.variables,
                  partialFields: hasPartialData,
                  fullData: event.data
                })
              }
            }
            
            // Log cache misses
            if (event.type === 'cacheMiss') {
              console.log('⚠️ URQL Cache miss:', {
                operation: event.operation?.query?.definitions?.[0]?.name?.value,
                variables: event.operation?.variables
              })
            }
          }
        })
      } catch (error) {
        console.log('URQL debug subscription not available:', error.message)
      }
    } else {
      console.log('URQL debug target subscription not available - this is normal in production builds')
    }

    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        try {
          unsubscribe()
        } catch (error) {
          console.warn('Error unsubscribing from URQL debug target:', error.message)
        }
      }
    }
  }, [client])

  return null
}

/**
 * Check if data contains null/undefined values that should exist
 */
function checkForPartialData (data, path = '') {
  const partialFields = []

  if (data && typeof data === 'object') {
    // Check message threads specifically
    if (data.me?.messageThreads?.items) {
      data.me.messageThreads.items.forEach((thread, index) => {
        if (!thread) {
          partialFields.push(`${path}me.messageThreads.items[${index}] is null`)
        } else {
          // Check essential thread fields
          if (!thread.id) partialFields.push(`${path}me.messageThreads.items[${index}].id missing`)
          if (!thread.participants) {
            partialFields.push(`${path}me.messageThreads.items[${index}].participants missing`)
          } else if (Array.isArray(thread.participants)) {
            thread.participants.forEach((p, pIndex) => {
              if (!p) {
                partialFields.push(`${path}me.messageThreads.items[${index}].participants[${pIndex}] is null`)
              } else {
                if (!p.id) partialFields.push(`${path}me.messageThreads.items[${index}].participants[${pIndex}].id missing`)
                if (!p.name) partialFields.push(`${path}me.messageThreads.items[${index}].participants[${pIndex}].name missing`)
              }
            })
          }
          
          // Check messages
          if (!thread.messages?.items) {
            partialFields.push(`${path}me.messageThreads.items[${index}].messages.items missing`)
          } else if (thread.messages.items.length > 0) {
            const latestMessage = thread.messages.items[0]
            if (!latestMessage) {
              partialFields.push(`${path}me.messageThreads.items[${index}].messages.items[0] is null`)
            } else {
              if (!latestMessage.id) partialFields.push(`${path}me.messageThreads.items[${index}].messages.items[0].id missing`)
              if (!latestMessage.creator) {
                partialFields.push(`${path}me.messageThreads.items[${index}].messages.items[0].creator missing`)
              } else {
                if (!latestMessage.creator.id) partialFields.push(`${path}me.messageThreads.items[${index}].messages.items[0].creator.id missing`)
              }
            }
          }
        }
      })
    }
  }

  return partialFields.length > 0 ? partialFields : null
}
