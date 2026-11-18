import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Maximize, Minus, Plus } from 'lucide-react'
import { cn } from 'util/index'

/**
 * The canvas block of a designed view: a surface larger than the screen that
 * people drag to pan and zoom in and out of, holding titled regions of blocks
 * laid out on a grid (see DesignedViewHelpers in @hylo/shared).
 *
 * The regions sit in an ordinary CSS grid, so each takes the height its content
 * needs; panning and zooming move and scale that grid as a whole.
 */

const REGION_WIDTH = 360
const GAP = 40
const PADDING = 48
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 1.25

const REGION_TONES = {
  plain: 'border-foreground/20 bg-card',
  accent: 'border-accent/60 bg-card',
  primary: 'border-primary/60 bg-card',
  muted: 'border-foreground/10 bg-muted'
}

const clampZoom = zoom => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))

// Things inside the canvas that take a click or a drag of their own
const INTERACTIVE = 'a, button, input, textarea, select, [role="button"]'

const MIN_HEIGHT = 420

export default function DesignedCanvas ({ block, renderBlock, fill = false }) {
  const { t } = useTranslation()
  const viewport = useRef(null)
  const frame = useRef(null)
  // When the canvas fills the view, it runs from where it starts down to the bottom of the window
  const [fillHeight, setFillHeight] = useState(null)
  const surface = useRef(null)
  const drag = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [dragging, setDragging] = useState(false)

  const columns = Math.max(...block.regions.map(region => region.col)) + 1

  useEffect(() => {
    if (!fill) return
    const measure = () => {
      const top = frame.current?.getBoundingClientRect().top
      if (typeof top === 'number') setFillHeight(Math.max(MIN_HEIGHT, Math.floor(window.innerHeight - top)))
    }
    measure()
    window.addEventListener('resize', measure)
    // The space above can change without the window resizing (a draft notice appearing, fonts loading)
    const observer = typeof ResizeObserver !== 'undefined' && frame.current?.parentElement ? new ResizeObserver(measure) : null
    observer?.observe(frame.current.parentElement)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [fill])

  // Zoom keeping the point under `origin` (viewport coordinates) where it is
  const zoomAt = useCallback((factor, origin) => {
    setView(current => {
      const zoom = clampZoom(current.zoom * factor)
      const ratio = zoom / current.zoom
      const rect = viewport.current?.getBoundingClientRect()
      const px = origin ? origin.x - rect.left : (rect?.width || 0) / 2
      const py = origin ? origin.y - rect.top : (rect?.height || 0) / 2
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }
    })
  }, [])

  const fit = useCallback(() => {
    const area = viewport.current
    const content = surface.current
    if (!area || !content) return
    const zoom = clampZoom(Math.min(area.clientWidth / content.offsetWidth, area.clientHeight / content.offsetHeight, 1))
    setView({
      zoom,
      x: Math.max(0, (area.clientWidth - content.offsetWidth * zoom) / 2),
      y: Math.max(0, (area.clientHeight - content.offsetHeight * zoom) / 2)
    })
  }, [])

  // The wheel pans; with Ctrl or Cmd (and trackpad pinch, which sends ctrlKey) it zooms.
  // Added by hand because React's wheel listener is passive and cannot stop the page scrolling.
  useEffect(() => {
    const area = viewport.current
    if (!area) return
    const onWheel = event => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-event.deltaY * 0.01), { x: event.clientX, y: event.clientY })
      } else {
        setView(current => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }))
      }
    }
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => area.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = event => {
    if (event.button !== 0 || event.target.closest(INTERACTIVE)) return
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: view.x, y: view.y }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = event => {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    setView(current => ({ ...current, x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY }))
  }

  const endDrag = event => {
    if (!drag.current) return
    event.currentTarget.releasePointerCapture?.(drag.current.pointerId)
    drag.current = null
    setDragging(false)
  }

  const onKeyDown = event => {
    const step = 80
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[event.key] && event.target === event.currentTarget) {
      event.preventDefault()
      const [dx, dy] = moves[event.key]
      setView(current => ({ ...current, x: current.x + dx, y: current.y + dy }))
    }
  }

  const dot = 24 * view.zoom

  return (
    <div
      ref={frame}
      data-block='canvas'
      data-fill={fill ? 'true' : undefined}
      className={cn('relative overflow-hidden bg-background', !fill && 'rounded-xl border-2 border-foreground/15')}
    >
      <div
        ref={viewport}
        role='region'
        aria-label={t('Canvas. Drag to move around, or use the arrow keys.')}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        data-testid='designed-canvas-viewport'
        className={cn('relative overflow-hidden touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus', !fill && 'h-[70vh] min-h-[420px]', dragging ? 'cursor-grabbing select-none' : 'cursor-grab')}
        style={{
          height: fill ? (fillHeight || '70vh') : undefined,
          backgroundImage: 'radial-gradient(hsl(var(--foreground) / 0.18) 1px, transparent 1px)',
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${view.x}px ${view.y}px`
        }}
      >
        <div
          ref={surface}
          data-testid='designed-canvas-surface'
          className='absolute top-0 left-0 grid items-start'
          style={{
            gridTemplateColumns: `repeat(${columns}, ${REGION_WIDTH}px)`,
            gap: GAP,
            padding: PADDING,
            transformOrigin: '0 0',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`
          }}
        >
          {block.regions.map((region, index) => (
            <section
              key={index}
              data-testid='designed-canvas-region'
              className={cn('rounded-xl border-2 p-4 flex flex-col gap-3 text-card-foreground shadow-sm cursor-auto', REGION_TONES[region.tone])}
              style={{ gridColumn: region.col + 1, gridRow: region.row + 1 }}
            >
              <header>
                <h2 className='text-lg font-bold m-0'>{region.title}</h2>
                {region.note && <p className='text-sm text-foreground/70 m-0'>{region.note}</p>}
              </header>
              {region.blocks.map((inner, innerIndex) => renderBlock(inner, innerIndex))}
            </section>
          ))}
        </div>
      </div>

      <div className='absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border-2 border-foreground/20 bg-card text-card-foreground p-1 shadow-sm'>
        <button type='button' onClick={() => zoomAt(1 / ZOOM_STEP)} aria-label={t('Zoom out')} className='inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted'>
          <Minus className='w-4 h-4' />
        </button>
        <span className='w-12 text-center text-xs tabular-nums' data-testid='designed-canvas-zoom'>{Math.round(view.zoom * 100)}%</span>
        <button type='button' onClick={() => zoomAt(ZOOM_STEP)} aria-label={t('Zoom in')} className='inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted'>
          <Plus className='w-4 h-4' />
        </button>
        <button type='button' onClick={fit} aria-label={t('Fit everything on screen')} className='inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted'>
          <Maximize className='w-4 h-4' />
        </button>
      </div>
      <p className='absolute bottom-3 left-3 m-0 rounded-md bg-card/90 text-card-foreground px-2 py-1 text-xs text-foreground/60 pointer-events-none'>
        {t('Drag to move around. Pinch or Ctrl-scroll to zoom.')}
      </p>
    </div>
  )
}
