import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { cn } from 'util/index'
import styles from './VirtualScrollbar.module.scss'

const SCROLLBAR_MIN_THUMB = 32

function isSafariLike () {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iP(ad|hone|od)/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Android/i.test(ua)
  return isIOS || isSafari
}

const VirtualScrollbar = forwardRef(function VirtualScrollbar (
  {
    children,
    className,
    style,
    viewportClassName,
    viewportStyle,
    contentClassName,
    trackClassName,
    thumbClassName,
    forceVirtual,
    scrollbarOffset = 18,
    onScroll,
    ...rest
  },
  ref
) {
  const wrapperRef = useRef(null)
  const viewportRef = useRef(null)
  const contentRef = useRef(null)
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const resizeObserverRef = useRef(null)
  const [useVirtual, setUseVirtual] = useState(false)
  const draggingState = useRef({
    top: 0,
    bottom: 0,
    height: 0
  })
  const metrics = useRef({
    scrollHeight: 0,
    viewportHeight: 0,
    scrollbarHeight: 0,
    thumbHeight: 0,
    scrollTop: 0,
    scrollPercentage: 0
  })

  useImperativeHandle(ref, () => viewportRef.current)

  useEffect(() => {
    if (typeof forceVirtual === 'boolean') {
      setUseVirtual(forceVirtual)
      return
    }
    setUseVirtual(isSafariLike())
  }, [forceVirtual])

  const clamp = useCallback((value, minValue, maxValue) => {
    return Math.min(Math.max(value, minValue), maxValue)
  }, [])

  const updateThumbPosition = useCallback(() => {
    const thumbEl = thumbRef.current
    const { scrollbarHeight, thumbHeight, scrollPercentage } = metrics.current
    if (!thumbEl || !scrollbarHeight) return
    const offset = (scrollbarHeight - thumbHeight) * scrollPercentage
    thumbEl.style.transform = `translateY(${offset}px)`
  }, [])

  const calculateMetrics = useCallback(() => {
    const viewportEl = viewportRef.current
    const contentEl = contentRef.current
    const trackEl = trackRef.current
    const thumbEl = thumbRef.current
    if (!viewportEl || !trackEl || !thumbEl) return

    const viewportHeight = viewportEl.clientHeight
    const contentHeight = contentEl ? contentEl.scrollHeight : viewportEl.scrollHeight
    const scrollHeight = Math.max(contentHeight - viewportHeight, 0)
    const scrollbarHeight = trackEl.clientHeight
    const thumbRatio = scrollHeight > 0 ? viewportHeight / contentHeight : 1
    const thumbHeight = Math.max(scrollbarHeight * thumbRatio, SCROLLBAR_MIN_THUMB)
    thumbEl.style.height = `${thumbHeight}px`

    metrics.current = {
      scrollHeight,
      viewportHeight,
      scrollbarHeight,
      thumbHeight,
      scrollTop: viewportEl.scrollTop,
      scrollPercentage: scrollHeight > 0 ? viewportEl.scrollTop / scrollHeight : 0
    }

    updateThumbPosition()
  }, [updateThumbPosition])

  const calculateScrollState = useCallback(() => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const scrollHeight = Math.max(viewportEl.scrollHeight - viewportEl.clientHeight, 0)
    const scrollTop = viewportEl.scrollTop
    metrics.current.scrollHeight = scrollHeight
    metrics.current.scrollTop = scrollTop
    metrics.current.scrollPercentage = scrollHeight > 0 ? scrollTop / scrollHeight : 0
    updateThumbPosition()
  }, [updateThumbPosition])

  const handleDragMove = useCallback((event) => {
    const viewportEl = viewportRef.current
    if (!viewportEl) return
    const { top, bottom, height } = draggingState.current
    const y = clamp(event.clientY, top, bottom)
    const offset = y - top
    const percentage = height > 0 ? offset / height : 0
    viewportEl.scrollTop = percentage * (viewportEl.scrollHeight - viewportEl.clientHeight)
    calculateScrollState()
  }, [calculateScrollState, clamp])

  const stopDragging = useCallback(() => {
    const wrapperEl = wrapperRef.current
    if (wrapperEl) {
      wrapperEl.classList.remove(styles.dragging)
    }
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', stopDragging)
  }, [handleDragMove])

  const startDragging = useCallback((event) => {
    event.preventDefault()
    const viewportEl = viewportRef.current
    const thumbEl = thumbRef.current
    const wrapperEl = wrapperRef.current
    if (!viewportEl || !thumbEl || !wrapperEl) return

    const viewportRect = viewportEl.getBoundingClientRect()
    const thumbRect = thumbEl.getBoundingClientRect()
    const initialY = event.clientY
    const thumbLocalY = initialY - thumbRect.top

    draggingState.current.top = viewportRect.top + thumbLocalY
    draggingState.current.bottom = viewportRect.bottom - thumbRect.height + thumbLocalY
    draggingState.current.height = draggingState.current.bottom - draggingState.current.top

    wrapperEl.classList.add(styles.dragging)
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', stopDragging)
  }, [handleDragMove, stopDragging])

  const pageScroll = useCallback((event) => {
    event.preventDefault()
    const viewportEl = viewportRef.current
    const thumbEl = thumbRef.current
    if (!viewportEl || !thumbEl) return
    const thumbRect = thumbEl.getBoundingClientRect()
    if (event.clientY < thumbRect.top) {
      viewportEl.scrollTop = Math.max(0, viewportEl.scrollTop - metrics.current.viewportHeight)
    } else {
      viewportEl.scrollTop = Math.min(viewportEl.scrollHeight, viewportEl.scrollTop + metrics.current.viewportHeight)
    }
    calculateScrollState()
  }, [calculateScrollState])

  const handleTrackMouseDown = useCallback((event) => {
    if (!useVirtual) return
    event.preventDefault()
    if (!trackRef.current || !thumbRef.current) return
    const isThumb = thumbRef.current.contains(event.target)
    if (isThumb) {
      startDragging(event)
    } else {
      pageScroll(event)
    }
  }, [pageScroll, startDragging, useVirtual])

  useEffect(() => {
    if (!useVirtual) return undefined
    const viewportEl = viewportRef.current
    if (!viewportEl) return undefined
    const contentEl = contentRef.current

    const handleScroll = (event) => {
      calculateScrollState()
      onScroll?.(event)
    }

    viewportEl.addEventListener('scroll', handleScroll, { passive: true })
    calculateMetrics()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        calculateMetrics()
      })
      resizeObserver.observe(viewportEl)
      if (contentEl) resizeObserver.observe(contentEl)
      resizeObserverRef.current = resizeObserver
    } else {
      const handler = () => calculateMetrics()
      window.addEventListener('resize', handler)
      resizeObserverRef.current = {
        disconnect: () => window.removeEventListener('resize', handler)
      }
    }

    return () => {
      viewportEl.removeEventListener('scroll', handleScroll)
      resizeObserverRef.current?.disconnect()
      stopDragging()
    }
  }, [calculateMetrics, calculateScrollState, onScroll, stopDragging, useVirtual])

  useEffect(() => {
    if (!useVirtual) {
      const viewportEl = viewportRef.current
      if (!viewportEl) return undefined
      const handleScroll = (event) => {
        onScroll?.(event)
      }
      viewportEl.addEventListener('scroll', handleScroll)
      return () => viewportEl.removeEventListener('scroll', handleScroll)
    }
    return undefined
  }, [onScroll, useVirtual])

  useEffect(() => {
    if (!useVirtual) return undefined
    const trackEl = trackRef.current
    if (!trackEl) return undefined
    trackEl.addEventListener('mousedown', handleTrackMouseDown)
    return () => {
      trackEl.removeEventListener('mousedown', handleTrackMouseDown)
    }
  }, [handleTrackMouseDown, useVirtual])

  useEffect(() => {
    return () => {
      stopDragging()
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, [stopDragging])

  const viewportProps = {
    ...rest,
    className: cn(styles.viewport, { [styles.viewportVirtual]: useVirtual }, viewportClassName),
    style: viewportStyle,
    onScroll: useVirtual ? undefined : onScroll
  }

  const wrapperStyle = useMemo(() => ({
    '--vs-scrollbar-offset': `${scrollbarOffset}px`,
    ...(style || {})
  }), [scrollbarOffset, style])

  return (
    <div ref={wrapperRef} className={cn(styles.wrapper, { [styles.hasVirtual]: useVirtual }, className)} style={wrapperStyle}>
      <div ref={viewportRef} {...viewportProps}>
        <div ref={contentRef} className={contentClassName}>
          {children}
        </div>
      </div>
      {useVirtual && (
        <div ref={trackRef} className={cn(styles.track, trackClassName)}>
          <div className={styles.trackBackground} />
          <div ref={thumbRef} className={cn(styles.thumb, thumbClassName)} />
        </div>
      )}
    </div>
  )
})

export default VirtualScrollbar
