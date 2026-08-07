import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Clamps a flex-wrap row of pills to maxRows rows, leaving room for a trailing
 * "more" pill. Attach containerRef to the wrapping flex container, render the
 * first visibleCount items, and append the more pill whenever clamped is true.
 * Measurement drops trailing items until everything (more pill included) fits;
 * it re-runs when the container resizes. Pass expanded=true to disable.
 */
export default function usePillRowClamp (itemCount, maxRows, expanded = false) {
  const containerRef = useRef(null)
  const [visibleCount, setVisibleCount] = useState(itemCount)

  // Start over from everything-visible whenever the inputs change
  useLayoutEffect(() => { setVisibleCount(itemCount) }, [itemCount, expanded])

  useLayoutEffect(() => {
    if (expanded) return
    const el = containerRef.current
    if (!el || !el.children.length) return
    const tops = Array.from(el.children).map(child => child.offsetTop)
    const rowTops = [...new Set(tops)].sort((a, b) => a - b)
    if (rowTops.length > maxRows) {
      const firstOverflow = tops.findIndex(top => top >= rowTops[maxRows])
      // One fewer than fits, so the more pill has a slot; converges across
      // the synchronous re-renders layout effects trigger
      setVisibleCount(count => Math.max(1, Math.min(count, firstOverflow) - 1))
    }
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let lastWidth = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth
        setVisibleCount(itemCount)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [itemCount])

  const effectiveCount = expanded ? itemCount : Math.min(visibleCount, itemCount)
  return { containerRef, visibleCount: effectiveCount, clamped: !expanded && effectiveCount < itemCount }
}
