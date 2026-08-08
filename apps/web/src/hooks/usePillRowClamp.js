import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Clamps a flex-wrap row of pills to maxRows rows, keeping room for a
 * trailing "more" pill. Attach containerRef to the wrapping flex container,
 * render ALL items inside it, and append the more pill as the LAST child
 * whenever expanded is false. The hook hides surplus pills (and the more
 * pill itself when everything fits) with inline display styles.
 *
 * visibleCount/clamped only feed the more pill's label — what React renders
 * never depends on measurement, so measuring can't trigger re-render loops
 * (the previous slice-by-state design hit React's nested-update limit).
 */
export default function usePillRowClamp (itemCount, maxRows, expanded = false) {
  const containerRef = useRef(null)
  // visibleCount starts low so the pre-measure more label renders at its
  // widest; measurement then only ever shrinks the label, never overflows
  const [state, setState] = useState({ visibleCount: 1, clamped: false })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const commit = (visibleCount, clamped) => {
      setState(prev => (prev.visibleCount === visibleCount && prev.clamped === clamped) ? prev : { visibleCount, clamped })
    }

    // Pills of differing heights get centered a few px apart within the same
    // visual row, so cluster nearby offsetTops instead of counting exact values
    const rowTops = nodes => {
      const tops = nodes.filter(node => node.style.display !== 'none').map(node => node.offsetTop).sort((a, b) => a - b)
      const rows = []
      tops.forEach(top => {
        if (!rows.length || top - rows[rows.length - 1] > 10) rows.push(top)
      })
      return rows
    }

    const measure = () => {
      const children = Array.from(el.children)
      if (!children.length) return
      children.forEach(child => { child.style.display = '' })
      if (expanded) {
        commit(itemCount, false)
        return
      }
      const more = children[children.length - 1]
      const items = children.slice(0, -1)
      if (!items.length) {
        more.style.display = 'none'
        commit(0, false)
        return
      }
      more.style.display = 'none'
      if (rowTops(items).length <= maxRows) {
        commit(items.length, false)
        return
      }
      more.style.display = ''
      let visible = items.length
      let guard = items.length
      while (visible > 1 && guard-- > 0) {
        const tops = rowTops(children)
        if (tops.length <= maxRows) break
        const overflowTop = tops[maxRows]
        let hid = 0
        for (let i = items.length - 1; i >= 0 && visible > 1; i--) {
          const item = items[i]
          if (item.style.display !== 'none' && item.offsetTop >= overflowTop) {
            item.style.display = 'none'
            hid++
            visible--
          }
        }
        if (!hid) {
          // Only the more pill itself overflows; free a slot for it
          for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].style.display !== 'none') {
              items[i].style.display = 'none'
              visible--
              break
            }
          }
        }
      }
      commit(visible, true)
    }

    measure()

    let raf = null
    const observer = new ResizeObserver(() => {
      if (raf != null) return
      raf = window.requestAnimationFrame(() => {
        raf = null
        measure()
      })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (raf != null) window.cancelAnimationFrame(raf)
    }
  }, [itemCount, maxRows, expanded])

  const visibleCount = expanded ? itemCount : Math.min(state.visibleCount, itemCount)
  return { containerRef, visibleCount, clamped: !expanded && state.clamped }
}
