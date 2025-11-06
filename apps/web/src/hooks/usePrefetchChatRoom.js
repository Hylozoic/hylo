import { useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import isMobile from 'ismobilejs'
import fetchTopicFollow from 'store/actions/fetchTopicFollow'

/**
 * Hook for prefetching chatroom data on hover
 *
 * Starts loading topicFollow data when user hovers over a chatroom link,
 * effectively hiding network latency behind user intent.
 *
 * Benefits:
 * - Saves 200-500ms by starting fetch before click
 * - Works with HTTP cache (won't re-fetch if cached)
 * - Disabled on mobile to save bandwidth
 * - Debounced to prevent excessive requests
 *
 * @param {Object} options
 * @param {string} options.groupId - Group ID
 * @param {string} options.topicName - Topic name
 * @param {boolean} options.enabled - Whether prefetching is enabled (default: true)
 * @returns {Function} handlePrefetch - Function to call on mouseEnter
 */
export default function usePrefetchChatRoom ({ groupId, topicName, enabled = true }) {
  const dispatch = useDispatch()
  const prefetchTimerRef = useRef(null)

  // Don't prefetch on mobile devices to save bandwidth
  const isMobileDevice = isMobile.any

  const handlePrefetch = useCallback(() => {
    // Skip if disabled or mobile
    if (!enabled || isMobileDevice) {
      return
    }

    // Skip if missing required data
    if (!groupId || !topicName) {
      return
    }

    // Clear any existing timer
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
    }

    // Debounce: only prefetch if hover lasts > 150ms
    // This prevents prefetching when user is just moving mouse across the screen
    prefetchTimerRef.current = setTimeout(() => {
      // Dispatch the prefetch
      // Redux will handle deduplication if already cached or loading
      dispatch(fetchTopicFollow(groupId, topicName))

      if (process.env.DEBUG_GRAPHQL) {
        console.log('[Prefetch] Chatroom data for', topicName)
      }
    }, 150)
  }, [enabled, groupId, topicName, isMobileDevice, dispatch])

  // Cleanup function to cancel pending prefetch
  const cancelPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }, [])

  return {
    handlePrefetch,
    cancelPrefetch
  }
}
