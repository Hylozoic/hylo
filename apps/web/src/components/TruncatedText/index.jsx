import React, { useCallback, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'

/**
 * Renders text with whatever truncation its classes impose (truncate,
 * line-clamp-N) and shows a tooltip with the full name only when the text
 * actually overflows. Overflow is measured at hover time, against the live
 * element — mount-time measurement raced fonts and re-layout and could
 * conclude "fits" for a label that truncated a beat later.
 */
export default function TruncatedText ({ as: Tag = 'span', text, className }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)

  const handleOpenChange = useCallback((next) => {
    if (!next) {
      setOpen(false)
      return
    }
    const el = ref.current
    // +1 absorbs subpixel rounding; covers single-line (width) and clamped (height)
    setOpen(Boolean(el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)))
  }, [])

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <Tag ref={ref} className={className}>{text}</Tag>
      </TooltipTrigger>
      <TooltipContent className='text-xs max-w-[280px] break-words'>{text}</TooltipContent>
    </Tooltip>
  )
}
