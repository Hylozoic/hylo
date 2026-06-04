import React from 'react'
import Skeleton from 'components/Skeleton'
import { STREAM_MAIN_COLUMN_CLASS } from 'util/mainContentColumn'
import { cn } from 'util/index'

/** Full-width map area + control strip while MapExplorer loads. */
export function MapExplorerBootstrapSkeleton () {
  return (
    <div
      className='flex flex-col w-full flex-1 min-h-[240px] px-1 sm:px-2 pb-4'
      aria-busy='true'
      aria-label='Loading map'
    >
      <Skeleton className='flex-1 w-full min-h-[220px] sm:min-h-[320px] rounded-lg' />
      <div className='flex flex-wrap items-center gap-2 mt-3 px-1'>
        <Skeleton className='h-9 w-28 rounded-md flex-shrink-0' />
        <Skeleton className='h-9 flex-1 min-w-[120px] max-w-md rounded-md' />
        <Skeleton className='h-9 w-9 rounded-md flex-shrink-0' />
      </div>
    </div>
  )
}

/** Subgroups / network page: hero map panel + group cards row. */
export function GroupSubgroupsBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading groups'>
      <Skeleton className='h-[200px] sm:h-[240px] w-full rounded-xl mb-6' />
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className='rounded-xl border-2 border-foreground/5 bg-card/50 p-4 flex flex-col gap-3'>
            <div className='flex items-center gap-3'>
              <Skeleton className='w-12 h-12 rounded-lg flex-shrink-0' />
              <div className='flex-1 flex flex-col gap-2'>
                <Skeleton className='h-3 w-[55%]' />
                <Skeleton className='h-2 w-[35%]' />
              </div>
            </div>
            <Skeleton className='h-2 w-full' />
            <Skeleton className='h-2 w-[88%]' />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Settings tabs + form fields. */
export function GroupSettingsBootstrapSkeleton () {
  return (
    <div
      className='w-full max-w-4xl mx-auto p-3 sm:p-6 flex flex-col sm:flex-row gap-6'
      aria-busy='true'
      aria-label='Loading settings'
    >
      <div className='hidden sm:flex flex-col gap-2 w-48 flex-shrink-0'>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className='h-9 w-full rounded-md' />
        ))}
      </div>
      <div className='flex-1 flex flex-col gap-4 min-w-0'>
        <Skeleton className='h-8 w-[40%] max-w-xs rounded-md sm:hidden' />
        <Skeleton className='h-6 w-[48%] max-w-sm' />
        <Skeleton className='h-10 w-full rounded-md' />
        <Skeleton className='h-10 w-full rounded-md' />
        <Skeleton className='h-24 w-full rounded-md' />
        <div className='flex gap-2 pt-2'>
          <Skeleton className='h-9 w-24 rounded-md' />
          <Skeleton className='h-9 w-20 rounded-md' />
        </div>
      </div>
    </div>
  )
}

/** Events / calendar-style neutral placeholder. */
export function EventsBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading events'>
      <div className='flex flex-wrap gap-2 mb-6'>
        <Skeleton className='h-9 w-32 rounded-full' />
        <Skeleton className='h-9 w-28 rounded-full' />
        <Skeleton className='h-9 w-24 rounded-full' />
      </div>
      <div className='grid grid-cols-7 gap-1 sm:gap-2 mb-4'>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className='h-8 w-full rounded-md' />
        ))}
      </div>
      <div className='grid grid-cols-7 gap-1 sm:gap-2'>
        {Array.from({ length: 28 }, (_, i) => (
          <Skeleton key={i} className='aspect-square w-full rounded-md opacity-80' />
        ))}
      </div>
      <div className='mt-8 flex flex-col gap-3'>
        {[0, 1, 2].map(i => (
          <div key={i} className='flex gap-3 items-start p-3 rounded-lg border border-foreground/5 bg-card/40'>
            <Skeleton className='w-14 h-14 rounded-md flex-shrink-0' />
            <div className='flex-1 flex flex-col gap-2 min-w-0'>
              <Skeleton className='h-3 w-[50%]' />
              <Skeleton className='h-2 w-[30%]' />
              <Skeleton className='h-2 w-full' />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Members directory: search + avatar rows. */
export function MembersBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading members'>
      <Skeleton className='h-10 w-full max-w-md rounded-lg mb-6' />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className='flex items-center gap-3 py-3 border-b border-foreground/5'>
          <Skeleton className='w-11 h-11 rounded-full flex-shrink-0' />
          <div className='flex-1 flex flex-col gap-2 min-w-0'>
            <Skeleton className='h-3 w-[38%]' />
            <Skeleton className='h-2 w-[62%]' />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Group about / profile-style blocks. */
export function GroupAboutBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full max-w-[800px]')} aria-busy='true' aria-label='Loading group'>
      <Skeleton className='h-36 sm:h-44 w-full rounded-xl mb-4' />
      <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center -mt-10 sm:-mt-12 px-2'>
        <Skeleton className='w-24 h-24 rounded-xl border-4 border-background flex-shrink-0' />
        <div className='flex-1 flex flex-col gap-2 pt-2 sm:pt-10'>
          <Skeleton className='h-5 w-[45%]' />
          <Skeleton className='h-3 w-[28%]' />
        </div>
      </div>
      <div className='mt-8 flex flex-col gap-3'>
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-[92%]' />
        <Skeleton className='h-3 w-[70%]' />
      </div>
    </div>
  )
}

/** Welcome page: hero + body sections. */
export function GroupWelcomeBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading welcome'>
      <Skeleton className='h-48 sm:h-56 w-full rounded-xl mb-8' />
      <Skeleton className='h-6 w-[60%] mb-4' />
      <div className='flex flex-col gap-2 mb-8'>
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-full' />
        <Skeleton className='h-3 w-[85%]' />
      </div>
      <Skeleton className='h-11 w-40 rounded-full' />
    </div>
  )
}

/** Tracks list or track home: header + card list. */
export function TracksBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading tracks'>
      <div className='flex items-center gap-3 mb-6'>
        <Skeleton className='h-10 w-10 rounded-lg' />
        <div className='flex-1 flex flex-col gap-2'>
          <Skeleton className='h-4 w-[50%]' />
          <Skeleton className='h-2 w-[32%]' />
        </div>
      </div>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className='rounded-xl border-2 border-foreground/5 bg-card/50 p-4 mb-3 flex gap-3'>
          <Skeleton className='w-16 h-16 rounded-lg flex-shrink-0' />
          <div className='flex-1 flex flex-col gap-2'>
            <Skeleton className='h-3 w-[55%]' />
            <Skeleton className='h-2 w-full' />
            <Skeleton className='h-2 w-[75%]' />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Funding rounds list or detail shell. */
export function FundingRoundsBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full')} aria-busy='true' aria-label='Loading funding rounds'>
      <Skeleton className='h-7 w-[55%] mb-6' />
      {[0, 1, 2].map(i => (
        <div key={i} className='rounded-xl border-2 border-foreground/5 overflow-hidden mb-4'>
          <Skeleton className='h-28 w-full' />
          <div className='p-4 flex flex-col gap-2'>
            <Skeleton className='h-4 w-[48%]' />
            <Skeleton className='h-2 w-full' />
            <Skeleton className='h-2 w-[60%]' />
            <Skeleton className='h-9 w-32 rounded-md mt-2' />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Moderation table-ish rows. */
export function ModerationBootstrapSkeleton () {
  return (
    <div className={cn(STREAM_MAIN_COLUMN_CLASS, 'w-full max-w-3xl')} aria-busy='true' aria-label='Loading moderation'>
      <Skeleton className='h-8 w-[42%] mb-4' />
      <div className='rounded-lg border border-foreground/10 overflow-hidden'>
        <div className='flex gap-2 p-3 bg-muted/30 border-b border-foreground/10'>
          <Skeleton className='h-3 flex-1' />
          <Skeleton className='h-3 w-20' />
          <Skeleton className='h-3 w-24 hidden sm:block' />
        </div>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className='flex gap-2 p-3 border-b border-foreground/5 items-center'>
            <Skeleton className='h-3 flex-1' />
            <Skeleton className='h-6 w-16 rounded-md' />
            <Skeleton className='h-6 w-20 rounded-md hidden sm:block' />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * All Views — matches `AllView.jsx`: responsive grid, dashed add tile, then widget cards
 * (`bg-card/40 border-2 border-card/30 rounded-lg`, centered title block).
 */
export function AllViewBootstrapSkeleton () {
  return (
    <div
      className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 w-full'
      aria-busy='true'
      aria-label='Loading views'
    >
      <div className='border-2 flex items-center justify-center border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 background-black/10 rounded-lg border-dashed relative min-h-[120px]'>
        <Skeleton className='h-7 w-36 max-w-[85%] rounded-md' />
      </div>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <div
          key={i}
          className='relative flex flex-col bg-card/40 border-2 border-card/30 shadow-md rounded-lg min-h-[120px] items-center justify-center p-4'
        >
          <div className='flex flex-col items-center gap-2 w-full max-w-[220px]'>
            <Skeleton className='h-5 w-[88%]' />
            <Skeleton className='h-4 w-[55%]' />
          </div>
        </div>
      ))}
    </div>
  )
}
