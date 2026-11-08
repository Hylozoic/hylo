import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import ProfileHoverCardPopover from './ProfileHoverCardPopover'
import getMe from 'store/selectors/getMe'

export const OPEN_DELAY = 500
export const CLOSE_DELAY = 200
export const LONG_PRESS_DELAY = 500
const LONG_PRESS_MOVE_TOLERANCE = 10

/**
 * Attaches a profile hover card to whatever element renders an avatar.
 *
 * Desktop: opens after hovering (or focusing) the trigger for OPEN_DELAY, stays
 * open while the pointer is over the card, closes on leave or Escape.
 * Touch: a long press opens it (normal taps still go through); tapping outside
 * closes it.
 *
 * Returns `ref` and `triggerProps` to spread onto the trigger element, and
 * `card`, which renders nothing until the card opens: there is no popover and no
 * request per avatar, so long lists stay cheap. Pass `personId: null` (or a
 * logged-out viewer) to get inert props.
 */
export function useProfileHoverCard (personId) {
  const currentUser = useSelector(getMe)
  const enabled = Boolean(personId && currentUser)
  const [open, setOpen] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const triggerRef = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)
  const pressTimer = useRef(null)
  const pressStart = useRef(null)
  const longPressed = useRef(false)

  const clearTimers = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    clearTimeout(pressTimer.current)
    pressTimer.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const scheduleOpen = useCallback(() => {
    clearTimeout(closeTimer.current)
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY)
  }, [])

  const scheduleClose = useCallback(() => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [])

  const close = useCallback(() => {
    clearTimers()
    setOpen(false)
  }, [clearTimers])

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), [])

  const onPointerEnter = useCallback(e => { if (e.pointerType === 'mouse') scheduleOpen() }, [scheduleOpen])
  const onPointerLeave = useCallback(e => { if (e.pointerType === 'mouse') scheduleClose() }, [scheduleClose])

  const onTouchStart = useCallback(e => {
    const touch = e.touches[0]
    pressStart.current = { x: touch.clientX, y: touch.clientY }
    longPressed.current = false
    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null
      longPressed.current = true
      setOpen(true)
    }, LONG_PRESS_DELAY)
  }, [])

  const onTouchMove = useCallback(e => {
    if (!pressTimer.current || !pressStart.current) return
    const touch = e.touches[0]
    if (Math.abs(touch.clientX - pressStart.current.x) > LONG_PRESS_MOVE_TOLERANCE ||
      Math.abs(touch.clientY - pressStart.current.y) > LONG_PRESS_MOVE_TOLERANCE) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }, [])

  const onTouchEnd = useCallback(e => {
    clearTimeout(pressTimer.current)
    pressTimer.current = null
    // Swallow the tap that ends a long press so it doesn't also follow the avatar's link
    if (longPressed.current && e.cancelable) e.preventDefault()
  }, [])

  const onClick = useCallback(e => {
    if (longPressed.current) {
      longPressed.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    // A real click does the avatar's own thing (navigate, open a dialog); get out of its way
    close()
  }, [close])

  // Long-pressing a link/image opens the browser's context menu on mobile
  const onContextMenu = useCallback(e => {
    if (pressTimer.current || longPressed.current) e.preventDefault()
  }, [])

  const triggerProps = useMemo(() => enabled && !unavailable
    ? {
        onPointerEnter,
        onPointerLeave,
        onFocus: scheduleOpen,
        onBlur: scheduleClose,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: onTouchEnd,
        onClick,
        onContextMenu,
        'data-profile-hover-card-trigger': personId
      }
    : {}, [enabled, unavailable, personId, onPointerEnter, onPointerLeave, scheduleOpen, scheduleClose, onTouchStart, onTouchMove, onTouchEnd, onClick, onContextMenu])

  const handleUnavailable = useCallback(() => {
    setUnavailable(true)
    close()
  }, [close])

  const card = enabled && open && !unavailable
    ? (
      <ProfileHoverCardPopover
        personId={personId}
        anchorRef={triggerRef}
        currentUser={currentUser}
        onClose={close}
        onUnavailable={handleUnavailable}
        onPointerEnter={cancelClose}
        onPointerLeave={onPointerLeave}
      />
      )
    : null

  return { ref: triggerRef, triggerProps, card, open }
}
