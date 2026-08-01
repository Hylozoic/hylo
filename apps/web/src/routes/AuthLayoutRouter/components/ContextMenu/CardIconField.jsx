import React, { useEffect, useId, useMemo, useState } from 'react'
import { icons } from 'lucide-react'

const ICON_FONT_FAMILY = 'hylo-evo-icons'

/** Codepoints are read from the stylesheet once per icon name, then reused. */
const glyphCache = new Map()

/**
 * Recovers the character behind a Hylo icon-font class (`.icon-Stream::before {
 * content: "\e91f" }`) by asking the browser, rather than duplicating the
 * codepoint table here — view icons come from the database, so there is no
 * static list to read from.
 */
function readFontGlyph (iconName) {
  if (glyphCache.has(iconName)) return glyphCache.get(iconName)
  if (typeof document === 'undefined') return null

  const probe = document.createElement('span')
  probe.className = `icon-${iconName}`
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px'
  document.body.appendChild(probe)
  const content = window.getComputedStyle(probe, '::before').content
  probe.remove()

  const glyph = content && content !== 'none' && content !== 'normal'
    ? content.replace(/^["']|["']$/g, '')
    : null
  glyphCache.set(iconName, glyph)
  return glyph
}

/**
 * SVG `<text>` paints a fallback glyph if the icon font hasn't arrived yet, so
 * the font branch waits for it. Lucide has no equivalent race.
 */
function useIconFontReady (enabled) {
  const [ready, setReady] = useState(() => !enabled || typeof document === 'undefined' || !document.fonts)

  useEffect(() => {
    if (!enabled || ready || typeof document === 'undefined' || !document.fonts) return undefined
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [enabled, ready])

  return ready
}

/**
 * Icon-as-wallpaper card background: the card's own glyph tiled as a rotated
 * grid, alternate rows offset by half an icon width.
 *
 * Drawn as a single SVG `<pattern>` rather than one element per glyph. The
 * element version laid out a ~17x16 grid — 272 nodes per card, several thousand
 * across a menu — which dominated style and layout, and made dragging the edit
 * grid lag. This is under ten nodes whatever the card size.
 *
 * Both icon sources tile from the same `<defs>` entry: Lucide icons contribute
 * their own markup, legacy Hylo font icons a `<text>` node. Inline SVG — unlike
 * an SVG used as a CSS background — resolves fonts against the document, which
 * is what makes the font branch possible at all.
 */
function CardIconField ({ view, tint, w, h, cell = 17, iconSize = 12 }) {
  // useId is unique per instance but contains colons, which url(#…) can't take
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const glyphId = `cif-glyph-${instanceId}`
  const patternId = `cif-pattern-${instanceId}`

  const lucideName = view?.lucideIcon && icons[view.lucideIcon] ? view.lucideIcon : null
  const fontIconName = !lucideName && view?.iconName ? view.iconName : null
  const fontReady = useIconFontReady(Boolean(fontIconName))
  const glyph = useMemo(
    () => (fontIconName && fontReady ? readFontGlyph(fontIconName) : null),
    [fontIconName, fontReady]
  )

  // One tile spans two rows so the half-cell stagger repeats correctly
  const { tileW, tileH, x, y } = useMemo(() => {
    const nx = Math.max(1, Math.round(w / cell))
    const ny = Math.max(1, Math.round(h / cell))
    const cellX = w / nx
    const cellY = h / ny
    return {
      tileW: cellX,
      tileH: cellY * 2,
      x: (cellX - iconSize) / 2,
      y: (cellY - iconSize) / 2
    }
  }, [w, h, cell, iconSize])

  const LucideGlyph = lucideName ? icons[lucideName] : null
  if (!LucideGlyph && !glyph) return null

  return (
    <svg
      aria-hidden='true'
      className='absolute inset-0 w-full h-full overflow-hidden opacity-[0.15] pointer-events-none'
      style={{ color: tint }}
    >
      <defs>
        {LucideGlyph
          ? (
            <g id={glyphId}>
              <LucideGlyph width={iconSize} height={iconSize} />
            </g>
            )
          : (
            // hanging baseline so the glyph box starts at y, matching how the
            // element version centred it in its cell
            <text
              id={glyphId}
              fontFamily={ICON_FONT_FAMILY}
              fontSize={iconSize}
              dominantBaseline='hanging'
              fill='currentColor'
            >
              {glyph}
            </text>
            )}
        <pattern
          id={patternId}
          width={tileW}
          height={tileH}
          patternUnits='userSpaceOnUse'
          patternTransform='rotate(-8)'
        >
          <use href={`#${glyphId}`} x={x} y={y} />
          {/* stagger alternating rows by half an icon width (brick layout) */}
          <use href={`#${glyphId}`} x={x + iconSize / 2} y={y + tileH / 2} />
        </pattern>
      </defs>
      <rect width='100%' height='100%' fill={`url(#${patternId})`} />
    </svg>
  )
}

// Memoised because a card re-renders on every drag event in the editable grid,
// and this subtree has no reason to follow.
export default React.memo(CardIconField)
