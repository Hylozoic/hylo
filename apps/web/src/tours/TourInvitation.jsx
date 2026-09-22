import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'

/**
 * Floating invitation to take a tour. Bottom-right on desktop, centered on
 * phones. Enters in two beats: the lightbulb button fades in rising from the
 * bottom, then the pill grows while the copy and actions fade in.
 *
 * Left untouched it calls onTimeout (offer again another day); declining is
 * final and accepting starts the tour.
 */
export default function TourInvitation ({ message, onAccept, onDecline, onTimeout, closing = false, onClosed, timeoutMs = 15000 }) {
  const { t } = useTranslation()
  // hidden → risen (lightbulb visible) → expanded (copy revealed) → leaving
  const [phase, setPhase] = useState('hidden')
  // The copy is laid out at full size from the start (w-max inner block) and
  // clipped by an overflow-hidden window animating to these measured pixels —
  // animating max-width instead would rewrap the text on every frame
  const contentRef = useRef(null)
  const [contentSize, setContentSize] = useState(null)

  useEffect(() => {
    const measure = () => {
      if (!contentRef.current) return
      const rect = contentRef.current.getBoundingClientRect()
      setContentSize({ width: Math.ceil(rect.width), height: Math.ceil(rect.height) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [message])

  useEffect(() => {
    const rise = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setPhase('risen')))
    const grow = setTimeout(() => setPhase('expanded'), 800)
    return () => {
      window.cancelAnimationFrame(rise)
      clearTimeout(grow)
    }
  }, [])

  useEffect(() => {
    if (phase !== 'expanded') return
    const timer = setTimeout(onTimeout, timeoutMs)
    return () => clearTimeout(timer)
  }, [phase, onTimeout, timeoutMs])

  // Asked to close (e.g. the route changed): fade out downward, then unmount
  useEffect(() => {
    if (!closing) return
    setPhase('leaving')
    const timer = setTimeout(() => onClosed && onClosed(), 450)
    return () => clearTimeout(timer)
  }, [closing, onClosed])

  return createPortal(
    <div
      role='dialog'
      aria-label={message}
      className={cn(
        'fixed z-[1000000] bottom-6 left-1/2 -translate-x-1/2',
        'transition-all duration-500 ease-out motion-reduce:transition-none',
        phase === 'hidden' || phase === 'leaving' ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 rounded-full max-sm:rounded-2xl bg-card text-card-foreground shadow-xl border-2 border-selected/40 overflow-hidden',
          'transition-all duration-500 ease-out motion-reduce:transition-none',
          phase === 'expanded' ? 'pl-2 pr-2 py-2' : 'p-2'
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-selected/20 text-selected shrink-0',
            'transition-all duration-500 ease-out motion-reduce:transition-none',
            phase === 'expanded' ? 'w-10 h-10' : 'w-9 h-9'
          )}
        >
          <Lightbulb className='w-5 h-5' />
        </span>
        <div
          className={cn(
            'overflow-hidden shrink-0 transition-all duration-500 ease-out motion-reduce:transition-none',
            phase === 'expanded' ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            width: phase === 'expanded' ? (contentSize ? contentSize.width : 'auto') : 0,
            height: phase === 'expanded' ? (contentSize ? contentSize.height : 'auto') : 0
          }}
        >
          <div
            ref={contentRef}
            className={cn(
              'flex items-center gap-2 w-max max-w-[min(420px,calc(100vw-5rem))]',
              // Phones stack the copy above the actions; a row would crush the
              // message into a sliver beside the buttons
              'max-sm:flex-col max-sm:items-start max-sm:gap-1.5'
            )}
          >
            <span className='text-sm leading-snug max-w-[220px] max-sm:max-w-none'>{message}</span>
            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                data-testid='tour-invite-accept'
                onClick={onAccept}
                className='shrink-0 whitespace-nowrap rounded-full bg-selected text-foreground text-sm font-bold px-3 py-1.5 hover:bg-selected/85 transition-colors'
              >
                {t('Show me')}
              </button>
              <button
                type='button'
                data-testid='tour-invite-decline'
                onClick={onDecline}
                className='shrink-0 whitespace-nowrap text-sm text-foreground/60 hover:text-foreground px-1.5 py-1.5 transition-colors'
              >
                {t('No thanks')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
