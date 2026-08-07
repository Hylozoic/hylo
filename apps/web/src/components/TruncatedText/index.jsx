import React, { useLayoutEffect, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'

/**
 * Renders text with whatever truncation its classes impose (truncate,
 * line-clamp-N), and — only when the text actually overflows — wraps it in a
 * tooltip carrying the full name. Non-overflowing titles get no tooltip at all.
 * Overflow is re-checked when the text changes and when the element resizes.
 */
export default function TruncatedText ({ as: Tag = 'span', text, className }) {
  const ref = useRef(null)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const check = () => {
      // +1 absorbs subpixel rounding; covers single-line (width) and clamped (height)
      setTruncated(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    }
    check()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    observer?.observe(el)
    // The web font loading widens text without resizing the element — a check
    // that ran against the fallback font can miss truncation that appears a
    // beat later, so re-check when fonts settle
    let cancelled = false
    document.fonts?.ready?.then(() => { if (!cancelled) check() })
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [text])

  const element = <Tag ref={ref} className={className}>{text}</Tag>
  if (!truncated) return element

  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent className='text-xs max-w-[280px] break-words'>{text}</TooltipContent>
    </Tooltip>
  )
}
