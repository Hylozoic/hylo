import { useEffect, useRef, useState } from 'react'
import isWebView from 'util/webView'

/**
 * Hook to detect pull-to-refresh gesture (web-side implementation)
 * 
 * Only triggers when:
 * 1. User is at scroll position 0 (top of page)
 * 2. User pulls DOWN past the threshold
 * 3. User HOLDS the pull position for the required duration
 * 4. Visual indicator shows when "ready to refresh"
 * 
 * This prevents accidental triggers from quick swipes or taps.
 * 
 * Performance: Minimal state updates - only when crossing threshold boundaries.
 * 
 * @param {Function} onRefresh - Callback when pull-to-refresh is triggered
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Pixels to pull before triggering (default: 120)
 * @param {number} options.holdDuration - Ms to hold at threshold before ready (default: 400)
 * @param {boolean} options.enabled - Whether gesture detection is enabled (default: true in WebView)
 */
export default function usePullToRefresh (onRefresh, options = {}) {
  const {
    threshold = 120,
    holdDuration = 400,
    enabled = isWebView() // Only enable in WebView by default
  } = options

  const touchStartY = useRef(null)
  const wasAtTop = useRef(false)
  const thresholdCrossedAt = useRef(null)
  const [isPulling, setIsPulling] = useState(false)
  const [isReadyToRefresh, setIsReadyToRefresh] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let holdTimer = null

    const handleTouchStart = (e) => {
      // Check if we're at the top of the scroll
      wasAtTop.current = window.scrollY <= 0

      if (wasAtTop.current) {
        touchStartY.current = e.touches[0].clientY
        thresholdCrossedAt.current = null
      }
    }

    const handleTouchMove = (e) => {
      if (!wasAtTop.current || touchStartY.current === null) return

      const currentY = e.touches[0].clientY
      const deltaY = currentY - touchStartY.current

      // Check if we've crossed the threshold while still at top
      const isPastThreshold = deltaY > threshold && window.scrollY <= 0

      if (isPastThreshold && !thresholdCrossedAt.current) {
        // Just crossed threshold - start hold timer
        thresholdCrossedAt.current = Date.now()
        setIsPulling(true)

        // Set timer for when hold duration is met
        holdTimer = setTimeout(() => {
          setIsReadyToRefresh(true)
        }, holdDuration)
      } else if (!isPastThreshold && thresholdCrossedAt.current) {
        // Went back above threshold - reset
        thresholdCrossedAt.current = null
        setIsPulling(false)
        setIsReadyToRefresh(false)
        if (holdTimer) {
          clearTimeout(holdTimer)
          holdTimer = null
        }
      }
    }

    const handleTouchEnd = () => {
      // Clear any pending timer
      if (holdTimer) {
        clearTimeout(holdTimer)
        holdTimer = null
      }

      // Check if we met the hold duration requirement
      if (thresholdCrossedAt.current) {
        const heldDuration = Date.now() - thresholdCrossedAt.current
        if (heldDuration >= holdDuration && window.scrollY <= 0) {
          setIsRefreshing(true)
          onRefresh()
        }
      }

      // Reset all state
      touchStartY.current = null
      wasAtTop.current = false
      thresholdCrossedAt.current = null
      setIsPulling(false)
      setIsReadyToRefresh(false)
    }

    // Use passive listeners for performance
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      if (holdTimer) clearTimeout(holdTimer)
    }
  }, [onRefresh, threshold, holdDuration, enabled])

  return { isPulling, isReadyToRefresh, isRefreshing }
}

