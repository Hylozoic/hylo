import React, { useRef, useLayoutEffect, useEffect, useCallback } from 'react'

/**
 * MasonryGrid wraps children in a CSS Grid that uses dynamic row-spans
 * to achieve a masonry layout while preserving left-to-right DOM order.
 *
 * How it works:
 * 1. Temporarily switches grid to auto-sized rows so children expand to natural height
 * 2. Measures each child's offsetHeight
 * 3. Switches to 1px rows and sets grid-row-end: span <height + gap> on each child
 *
 * The className should provide `display: grid`, `grid-template-columns`, and `column-gap`.
 * Row sizing and row-gap are managed by this component.
 *
 * @param {boolean} enabled - When false, renders a plain div (for non-grid views)
 * @param {number} gap - Vertical gap between items in px (default 8)
 * @param {string} className - CSS classes for the grid container
 */
export default function MasonryGrid ({ children, enabled = true, gap = 8, className }) {
  const gridRef = useRef(null)

  const layout = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const items = Array.from(grid.children)
    if (!items.length) return

    // Phase 1: auto-sized rows to measure natural heights
    grid.style.gridAutoRows = 'auto'
    grid.style.rowGap = `${gap}px`
    items.forEach(item => { item.style.gridRowEnd = '' })

    // Force synchronous reflow then measure
    const heights = items.map(item => item.offsetHeight)

    // Phase 2: 1px rows with calculated spans for masonry
    grid.style.gridAutoRows = '1px'
    grid.style.rowGap = '0px'
    items.forEach((item, i) => {
      item.style.gridRowEnd = `span ${heights[i] + gap}`
    })
  }, [gap])

  // Run before paint to prevent layout flash
  useLayoutEffect(() => {
    if (!enabled) return
    layout()
  })

  // Re-layout on container resize or child list changes
  useEffect(() => {
    if (!enabled) return
    const grid = gridRef.current
    if (!grid) return

    const ro = new ResizeObserver(() => layout())
    ro.observe(grid)

    const mo = new MutationObserver(() => layout())
    mo.observe(grid, { childList: true })

    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [enabled, layout])

  return (
    <div ref={gridRef} className={className}>
      {children}
    </div>
  )
}
