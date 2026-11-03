import { useCallback, useEffect, useRef } from 'react'
import { useLongPress, LongPressDetectEvents } from 'use-long-press'

export const LONG_PRESS_MS = 500
export const LONG_PRESS_MOVE_TOLERANCE = 10

/**
 * Touch-only long press. Mouse users keep hover/click as they are.
 *
 * Returns `handlers` to spread on the pressable element and `consumeLongPress()`,
 * which an onClick handler calls to swallow the click that follows a long press.
 * Moving more than `moveTolerance` px cancels the press so scrolling still works,
 * and the browser's long-press context menu is suppressed.
 */
export default function useTouchLongPress (onLongPress, { threshold = LONG_PRESS_MS, moveTolerance = LONG_PRESS_MOVE_TOLERANCE } = {}) {
  const firedRef = useRef(false)
  const resetTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(resetTimerRef.current), [])

  const bind = useLongPress(onLongPress
    ? () => {
        firedRef.current = true
        onLongPress()
      }
    : null, {
    threshold,
    cancelOnMovement: moveTolerance,
    detect: LongPressDetectEvents.TOUCH
  })

  const consumeLongPress = useCallback(() => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])

  if (!onLongPress) return { handlers: {}, consumeLongPress }

  const { onTouchStart, onTouchMove, onTouchEnd } = bind()

  return {
    consumeLongPress,
    handlers: {
      onTouchStart: (e) => {
        clearTimeout(resetTimerRef.current)
        firedRef.current = false
        // Keep an outer long press (e.g. the chat post action menu) from starting too
        e.stopPropagation()
        onTouchStart(e)
      },
      onTouchMove,
      onTouchEnd: (e) => {
        if (firedRef.current) {
          // No synthetic click after a long press; the timer covers browsers that send one anyway
          e.preventDefault()
          resetTimerRef.current = setTimeout(() => { firedRef.current = false }, 600)
        }
        onTouchEnd(e)
      },
      onTouchCancel: onTouchEnd,
      onContextMenu: (e) => e.preventDefault()
    }
  }
}
