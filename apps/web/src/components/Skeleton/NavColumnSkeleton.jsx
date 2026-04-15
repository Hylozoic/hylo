import React from 'react'
import Skeleton from 'components/Skeleton'
import { cn } from 'util/index'

/**
 * Mirrors AuthLayoutRouter’s left chrome: GlobalNav rail (~66–80px) + ContextMenu panel (300px on sm+),
 * inside the same flex constraints as `AuthLayoutRouterNavContainer` (`sm:max-w-[420px]`).
 * Hidden below `sm` — matches real layout when the drawer is closed (center is full width).
 */
export default function NavColumnSkeleton ({ className }) {
  return (
    <div
      className={cn(
        'AuthLayoutRouterNavContainer flex flex-row h-full flex-shrink-0 overflow-hidden',
        'fixed left-0 top-0 z-[101] h-dvh w-full',
        'sm:relative sm:z-50 sm:h-full sm:w-auto sm:max-w-[420px]',
        'hidden sm:flex',
        className
      )}
      aria-hidden='true'
    >
      {/* GlobalNav rail — widths align with ContextMenu `left-[66px] sm:left-[80px]` offsets */}
      <div
        className={cn(
          'flex flex-col items-center bg-card relative h-full z-[50] flex-shrink-0',
          'w-[66px] sm:w-20',
          'pt-4 px-2 sm:px-3 overflow-y-auto border-r border-border/30'
        )}
        style={{
          boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.4)'
        }}
      >
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className='w-10 h-10 rounded-full mb-3 flex-shrink-0' />
        ))}
      </div>

      {/* ContextMenu panel — matches `sm:w-[300px]` + list / header feel */}
      <div
        className={cn(
          'relative h-full flex-1 min-w-0 overflow-y-auto overflow-x-hidden',
          'bg-background z-20 isolate flex flex-col',
          'sm:w-[300px] sm:flex-none sm:flex-shrink-0',
          'border-r border-border/40',
          'shadow-[4px_0_2px_-2px_rgba(0,0,0,0.1)]'
        )}
      >
        {/*
          Same height as GroupMenuHeader / TheCommonsHeader / MyHomeHeader (h-[190px]).
        */}
        <div className='relative w-full flex-shrink-0 shadow-md'>
          <Skeleton className='h-[190px] w-full rounded-none' />
          <div
            className='absolute inset-x-0 bottom-0 p-2 flex flex-row items-end gap-2 pointer-events-none'
            aria-hidden
          >
            <Skeleton className='h-10 w-10 rounded-lg flex-shrink-0' />
            <div className='flex-1 flex flex-col gap-2 pb-0.5 min-w-0'>
              <Skeleton className='h-5 w-[78%] max-w-[200px]' />
              <Skeleton className='h-3 w-[48%] max-w-[140px]' />
            </div>
          </div>
        </div>
        <div className='px-3 pt-2 flex-1 min-h-0'>
          <div className='border-b-2 border-foreground/10 pb-4 mb-2' />
          {['w-[88%]', 'w-[72%]', 'w-[80%]', 'w-[64%]', 'w-[76%]', 'w-[58%]', 'w-[84%]', 'w-[70%]'].map((wClass, i) => (
            <div key={i} className='flex items-start gap-3 py-2.5'>
              <Skeleton className='w-8 h-8 rounded-md flex-shrink-0 mt-0.5' />
              <Skeleton className={cn('h-3 max-w-[200px]', wClass)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
