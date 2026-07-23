import React from 'react'
import { bgImageStyle, cn } from 'util/index'
import GroupViewIcon from './GroupViewIcon'
import { viewCardColor, hueOf } from './viewCardTheme'

/**
 * Background revealed behind the selected (or hovered) context-menu row —
 * mirroring the one-column dashboard cards. Spaces with an uploaded banner
 * show the photo; everything else shows a repeating texture of the row's own
 * icon, tinted to the item's post-type color, with a left-to-right scrim for
 * label contrast. Pass opacity/transition classes via `className` to fade.
 */
export default function MenuRowBackground ({ view, bannerUrl, className }) {
  if (bannerUrl) {
    return (
      <div aria-hidden='true' className={cn('absolute inset-0 z-0 overflow-hidden rounded-md pointer-events-none', className)}>
        <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
        <div className='absolute inset-0' style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 55%, rgba(0,0,0,0.62) 100%)' }} />
      </div>
    )
  }

  const h = hueOf(viewCardColor(view))
  return (
    <div
      aria-hidden='true'
      className={cn('absolute inset-0 z-0 overflow-hidden rounded-md pointer-events-none', className)}
      style={{ background: `linear-gradient(135deg, hsl(${h} 40% 22%) 0%, hsl(${h} 42% 15%) 100%)` }}
    >
      {/* The -8° tilt (top-left origin) lifts each row's right end by ~sin(8°)·width,
          so supply enough extra rows that the bottom-right corner stays covered. */}
      <div
        className='absolute -top-1.5 -left-1.5 -right-1.5 flex flex-wrap'
        style={{ gap: 7, opacity: 0.18, color: `hsl(${h} 70% 82%)`, transform: 'rotate(-8deg)', transformOrigin: 'top left' }}
      >
        {Array.from({ length: 96 }, (_, i) => (
          <span key={i} className='flex'>
            <GroupViewIcon view={view} className='!w-[13px] !h-[13px] !mr-0' />
          </span>
        ))}
      </div>
      <div className='absolute inset-0' style={{ background: `linear-gradient(90deg, hsl(${h} 42% 14% / 0.65) 0%, transparent 60%)` }} />
    </div>
  )
}
