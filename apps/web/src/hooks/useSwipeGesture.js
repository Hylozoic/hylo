import { useEffect, useRef } from 'react'

/**
 * Hook to detect swipe-from-edge gestures for navigation menu
 * 
 * Detects:
 * - Left-to-right swipe starting from the left edge to open menu
 * - Right-to-left swipe to close menu (when onSwipeRight provided)
 * 
 * @param {Function} onSwipeFromLeft - Callback when swipe-from-left is detected (open menu)
 * @param {Object} options - Configuration options
 * @param {number} options.edgeWidth - Width of edge zone to detect swipe start (default: 30px)
 * @param {number} options.minSwipeDistance - Minimum distance to trigger swipe (default: 50px)
 * @param {boolean} options.enabled - Whether gesture detection is enabled (default: true)
 * @param {Function} options.onSwipeRight - Optional callback for right-to-left swipe (close menu)
 */
export default function useSwipeGesture (onSwipeFromLeft, options = {}) {
  const {
    edgeWidth = 30,
    minSwipeDistance = 50,
    enabled = true,
    onSwipeRight = null
  } = options

  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const startedFromEdge = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY

      // Check if touch started within the left edge zone
      startedFromEdge.current = touch.clientX <= edgeWidth
    }

    const handleTouchMove = (e) => {
      if (touchStartX.current === null) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = touch.clientY - touchStartY.current

      // Check if it's a horizontal swipe (more horizontal than vertical)
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.5

      if (!isHorizontalSwipe) return

      // Swipe from left edge to right (open menu)
      if (startedFromEdge.current && deltaX > minSwipeDistance) {
        onSwipeFromLeft()
        
        // Reset to prevent multiple triggers
        touchStartX.current = null
        touchStartY.current = null
        startedFromEdge.current = false
      }
      
      // Swipe from right to left (close menu)
      if (onSwipeRight && deltaX < -minSwipeDistance) {
        onSwipeRight()
        
        // Reset to prevent multiple triggers
        touchStartX.current = null
        touchStartY.current = null
        startedFromEdge.current = false
      }
    }

    const handleTouchEnd = () => {
      // Reset on touch end
      touchStartX.current = null
      touchStartY.current = null
      startedFromEdge.current = false
    }

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [onSwipeFromLeft, onSwipeRight, edgeWidth, minSwipeDistance, enabled])
}

