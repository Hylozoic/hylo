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
// Each row holds enough glyphs to cover the widest surface (join page card at
// 840px); overflow-hidden clips the rest. Odd rows shift by half the glyph
// pitch so the texture reads as a diagonal lattice rather than a grid.

// rows defaults to enough for a menu row; taller surfaces pass more.
// spaced doubles the pitch on both axes for banner-height surfaces —
// half as many glyphs covering the same area.
function MenuRowBackground ({ view, bannerUrl, className, rows = 6, spaced = false }) {
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'

  // Pitch is glyph size (13) + gap: 20, doubled to 40 when spaced
  const pitch = spaced ? 40 : 20
  const gap = pitch - 13
  const cols = spaced ? 24 : 48

  // Memoized like CardIconField's tile: the glyph spans are not worth re-creating
  // on every render. Before the early banner return — hooks run unconditionally.
  const glyphRows = useMemo(() => Array.from({ length: rows }, (_, r) => (
    <div
      key={r}
      className='flex shrink-0'
      style={{ gap, marginTop: r === 0 ? 0 : gap, marginLeft: r % 2 ? -(pitch / 2) : 0 }}
    >
      {Array.from({ length: cols }, (_, i) => (
        <span key={i} className='flex shrink-0'>
          <GroupViewIcon view={view} className='!w-[13px] !h-[13px] !mr-0' />
        </span>
      ))}
    </div>
  )), [view, rows, gap, pitch, cols])

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
        className='absolute -top-1.5 -left-1.5 -right-1.5 flex flex-col'
        style={{ opacity: 0.12, color: glyphColor, transform: 'rotate(-8deg)', transformOrigin: 'top left' }}
      >
        {glyphRows}
      </div>
      <div className='absolute inset-0' style={{ background: scrim }} />
    </div>
  )
}

export default React.memo(MenuRowBackground)
