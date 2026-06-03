import React from 'react'
import Skeleton from 'components/Skeleton'

/**
 * Skeleton placeholder for PostDetail — mirrors the exact layout of the
 * expanded post view: header, group pill, optional image, title, body lines,
 * footer/reactions, and a few comment outlines.
 */
export default function PostDetailSkeleton () {
  return (
    <div className='PostDetail w-full max-w-[960px] mx-auto min-w-[290px] sm:min-w-[350px] relative' aria-busy='true' aria-label='Loading post'>
      <div className='flex flex-col rounded-lg shadow-sm'>

        {/* Post header: close button, avatar, creator name, timestamp */}
        <div className='flex items-center gap-3 p-3 border-b border-foreground/5'>
          <Skeleton className='w-[38px] h-[38px] rounded-full flex-shrink-0' />
          <div className='flex-1 flex flex-col gap-1.5'>
            <Skeleton className='h-[11px] w-[42%]' />
            <Skeleton className='h-[8px] w-[24%]' />
          </div>
          {/* Close / back button placeholder */}
          <Skeleton className='w-[28px] h-[28px] rounded-full flex-shrink-0' />
        </div>

        {/* Group pill */}
        <div className='flex items-center gap-2 px-3 py-2 border-b border-foreground/5'>
          <Skeleton className='w-[18px] h-[18px] rounded-full flex-shrink-0' />
          <Skeleton className='h-[10px] w-[110px]' />
        </div>

        {/* Post body card */}
        <div className='bg-card rounded-lg shadow-md'>
          {/* Hero image placeholder */}
          <Skeleton className='h-[180px] w-full rounded-t-lg' />

          <div className='p-4'>
            {/* Post title */}
            <Skeleton className='h-[18px] w-[74%] mb-4' />
            {/* Body paragraphs */}
            <div className='flex flex-col gap-[9px] mb-4'>
              <Skeleton className='h-[10px] w-full' />
              <Skeleton className='h-[10px] w-full' />
              <Skeleton className='h-[10px] w-[93%]' />
              <Skeleton className='h-[10px] w-[82%]' />
              <Skeleton className='h-[10px] w-[63%]' />
            </div>
          </div>

          {/* Footer: reactions + comment count */}
          <div className='flex items-center gap-2 px-4 py-2.5 border-t border-foreground/5'>
            <Skeleton className='h-[26px] w-[68px] rounded-full' />
            <Skeleton className='h-[26px] w-[52px] rounded-full' />
            <div className='flex-1' />
            <Skeleton className='h-[26px] w-[44px] rounded-full' />
          </div>
        </div>

        {/* Comments section */}
        <div className='mt-2 px-1'>
          {/* "Comments" label */}
          <Skeleton className='h-[10px] w-[90px] mb-4' />

          {/* Three comment outlines */}
          {[0, 1, 2].map(i => (
            <div key={i} className='flex gap-2 mb-4'>
              <Skeleton className='w-[28px] h-[28px] rounded-full flex-shrink-0 mt-0.5' />
              <div className='flex-1 bg-background rounded-xl p-3 flex flex-col gap-[7px]'>
                <Skeleton className='h-[9px] w-[30%]' />
                <Skeleton className='h-[9px] w-full' />
                <Skeleton className='h-[9px] w-[72%]' />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
