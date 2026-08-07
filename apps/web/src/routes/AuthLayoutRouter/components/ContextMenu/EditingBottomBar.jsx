import React, { useEffect, useRef, useState } from 'react'

/**
 * Fixed bar at the foot of an editing screen, holding the Done Editing control.
 *
 * It is fixed to the viewport, so it has to be told how wide to be — left to
 * itself it would stretch under the nav and the sidebar. It measures the
 * container it is given and spans that instead, which is why the gradient runs
 * the full width of the column rather than the narrower content well inside it.
 */
export default function EditingBottomBar ({ containerRef, children }) {
  const [rect, setRect] = useState(null)
  const frame = useRef(null)

  useEffect(() => {
    const measure = () => {
      const el = containerRef?.current
      if (!el) return
      // The bar tracks the column, not the max-width content well within it
      const target = el.parentElement || el
      const { left, width } = target.getBoundingClientRect()
      setRect({ left, width })
    }

    const schedule = () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
    if (observer && containerRef?.current?.parentElement) {
      observer.observe(containerRef.current.parentElement)
    }

    return () => {
      window.removeEventListener('resize', schedule)
      if (frame.current) cancelAnimationFrame(frame.current)
      observer?.disconnect()
    }
  }, [containerRef])

  return (
    <div
      // Same wash as the pinned stream header, mirrored so the shadow originates at
      // the bottom edge: theme background at 10% alpha (50% in dark, where the wash
      // would otherwise vanish) fading to the same colour at zero — not `transparent`,
      // which would interpolate toward transparent black and smudge grey in light mode.
      className='fixed bottom-0 z-30 pt-8 pb-3 px-4 flex justify-center bg-gradient-to-t from-[hsl(var(--theme-background)/0.1)] dark:from-[hsl(var(--theme-background)/0.5)] to-[hsl(var(--theme-background)/0)] pointer-events-none'
      style={rect ? { left: rect.left, width: rect.width } : { left: 0, right: 0 }}
    >
      {children}
    </div>
  )
}

/** The control itself, so both editing screens offer the same target. */
export const EDITING_BAR_BUTTON_CLASS = 'pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm transition-all shadow-lg bg-background border-selected text-selected hover:bg-selected/10'
