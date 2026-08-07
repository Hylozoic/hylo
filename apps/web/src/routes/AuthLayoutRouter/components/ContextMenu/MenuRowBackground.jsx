import React, { useMemo } from 'react'
import useAppearance from 'hooks/useAppearance'
import { bgImageStyle, cn } from 'util/index'
import GroupViewIcon from './GroupViewIcon'
import { viewCardColor, hueOf } from './viewCardTheme'

/**
 * Background revealed behind the selected (or hovered) context-menu row —
 * mirroring the one-column dashboard cards. Spaces with an uploaded banner
 * show the photo; other views show a repeating icon texture tinted to the
 * view color (post-type brand, or slate grey).
 * Pass opacity/transition classes via `className` to fade.
 */
// glyphCount defaults to enough for a menu row; taller surfaces (the About
// modal banner) pass more so the wallpaper reaches the bottom
function MenuRowBackground ({ view, bannerUrl, className, glyphCount = 96 }) {
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'

  // Memoized like CardIconField's tile: the glyph spans are not worth re-creating
  // on every render. Before the early banner return — hooks run unconditionally.
  const glyphs = useMemo(() => Array.from({ length: glyphCount }, (_, i) => (
    <span key={i} className='flex'>
      <GroupViewIcon view={view} className='!w-[13px] !h-[13px] !mr-0' />
    </span>
  )), [view, glyphCount])

  if (bannerUrl) {
    return (
      <div aria-hidden='true' className={cn('absolute inset-0 z-0 overflow-hidden rounded pointer-events-none', className)}>
        <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
        <div className='absolute inset-0' style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.48) 55%, rgba(0,0,0,0.62) 100%)' }} />
      </div>
    )
  }

  const h = hueOf(viewCardColor(view))
  const surface = isDark
    ? `linear-gradient(135deg, hsl(${h} 34% 26%) 0%, hsl(${h} 36% 19%) 100%)`
    : `linear-gradient(135deg, hsl(${h} 48% 93%) 0%, hsl(${h} 42% 86%) 100%)`
  const glyphColor = isDark ? `hsl(${h} 70% 82%)` : `hsl(${h} 50% 34%)`
  const scrim = isDark
    ? `linear-gradient(90deg, hsl(${h} 36% 18% / 0.65) 0%, transparent 60%)`
    : `linear-gradient(90deg, hsl(${h} 48% 93% / 0.65) 0%, transparent 60%)`

  return (
    <div
      aria-hidden='true'
      className={cn('absolute inset-0 z-0 overflow-hidden rounded pointer-events-none', className)}
      style={{ background: surface }}
    >
      {/* The -8° tilt (top-left origin) lifts each row's right end by ~sin(8°)·width,
          so supply enough extra rows that the bottom-right corner stays covered. */}
      <div
        className='absolute -top-1.5 -left-1.5 -right-1.5 flex flex-wrap'
        style={{ gap: 7, opacity: 0.12, color: glyphColor, transform: 'rotate(-8deg)', transformOrigin: 'top left' }}
      >
        {glyphs}
      </div>
      <div className='absolute inset-0' style={{ background: scrim }} />
    </div>
  )
}

export default React.memo(MenuRowBackground)
