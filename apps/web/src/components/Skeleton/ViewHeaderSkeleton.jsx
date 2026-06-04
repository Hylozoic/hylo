import React from 'react'
import Skeleton from 'components/Skeleton'
import { cn } from 'util/index'

/** Thin bar matching ViewHeader height while bootstrap data loads. */
export default function ViewHeaderSkeleton ({ className }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 flex-shrink-0 min-h-[52px] px-3 py-2 border-b border-border/40 bg-background/80',
        className
      )}
      aria-hidden='true'
    >
      <Skeleton className='h-8 w-8 rounded-md flex-shrink-0 sm:hidden' />
      <Skeleton className='h-4 w-[32%] max-w-[200px]' />
      <div className='flex-1' />
      <Skeleton className='h-8 w-8 rounded-md flex-shrink-0' />
    </div>
  )
}
