import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

const STORAGE_KEY = 'hyloContextMenuWidth'
// The menu's regular sm+ width is the floor — dragging can only widen it
const MIN_WIDTH = 300
const MAX_WIDTH = 600

const readSavedWidth = () => {
  const saved = parseInt(window.localStorage.getItem(STORAGE_KEY), 10)
  if (!Number.isFinite(saved)) return MIN_WIDTH
  return Math.min(Math.max(saved, MIN_WIDTH), MAX_WIDTH)
}

/**
 * Desktop-only drag strip on the seam between the context menu and the view
 * column: an invisible 6px band whose left edge hugs the view column's inner
 * border, from the top of the viewport to the bottom. Hovering surfaces a wash
 * and a 2px dashed line with a grab cursor. Dragging rewrites the
 * --context-menu-width variable the menu's width class reads, clamped to
 * 300–600px, and the choice persists in localStorage.
 */
export default function ContextMenuResizer ({ menuEl }) {
  const { t } = useTranslation()
  const [left, setLeft] = useState(null)
  const [width, setWidth] = useState(readSavedWidth)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(null)

  // Before paint, so a saved width never flashes the default first
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--context-menu-width', `${width}px`)
  }, [width])

  useEffect(() => {
    if (!menuEl) return
    const update = () => setLeft(menuEl.getBoundingClientRect().right)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(menuEl)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [menuEl])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth: width }
    setDragging(true)
  }, [width])

  const onPointerMove = useCallback((e) => {
    const drag = dragRef.current
    if (!drag) return
    setWidth(Math.min(Math.max(drag.startWidth + e.clientX - drag.startX, MIN_WIDTH), MAX_WIDTH))
  }, [])

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    setWidth(current => {
      window.localStorage.setItem(STORAGE_KEY, String(Math.round(current)))
      return current
    })
  }, [])

  if (left === null) return null

  return (
    <div
      role='separator'
      aria-orientation='vertical'
      aria-label={t('Adjust menu width')}
      className={cn(
        'fixed top-0 bottom-0 z-30 w-[6px] hidden sm:block group touch-none select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ left }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={cn(
        'absolute inset-0 transition-colors',
        dragging ? 'bg-[hsl(var(--theme-background)/0.2)]' : 'group-hover:bg-[hsl(var(--theme-background)/0.2)]'
      )}
      />
      <div className={cn(
        'absolute top-0 bottom-0 left-1/2 -ml-px border-l-2 border-dashed transition-colors',
        dragging ? 'border-foreground/40' : 'border-transparent group-hover:border-foreground/40'
      )}
      />
    </div>
  )
}
