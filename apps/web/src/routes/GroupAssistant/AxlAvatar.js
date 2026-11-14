import React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from 'util/index'

/** Axl's mark: a sparkle on the group's accent colour. */
export default function AxlAvatar ({ size = 32, className }) {
  return (
    <span
      title='Axl'
      aria-hidden='true'
      style={{ width: size, height: size }}
      className={cn('inline-grid place-items-center shrink-0 rounded-full bg-accent text-white ring-2 ring-accent/40 ring-offset-2 ring-offset-background', className)}
    >
      <Sparkles style={{ width: Math.round(size * 0.52), height: Math.round(size * 0.52) }} strokeWidth={2} />
    </span>
  )
}
