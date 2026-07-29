import React, { useMemo } from 'react'
import GroupViewIcon from './GroupViewIcon'

/**
 * Icon-as-pattern card background: the card's own glyph repeated as a rotated
 * grid, with alternating rows offset by half an icon width. Every glyph renders
 * at the same faint opacity — plain wallpaper behind the card content.
 */
export default function CardIconField ({ view, tint, w, h, cell = 17, iconSize = 12, iconClassName = '!w-3 !h-3 !mr-0' }) {
  const { rows, cols, cellX, cellY, pad } = useMemo(() => {
    const nx = Math.max(1, Math.round(w / cell))
    const ny = Math.max(1, Math.round(h / cell))
    const pad = 3
    return {
      rows: ny + 1 + pad * 2,
      cols: nx + 1 + pad * 2,
      cellX: w / nx,
      cellY: h / ny,
      pad
    }
  }, [w, h, cell])

  return (
    <div aria-hidden='true' className='absolute inset-0 overflow-hidden opacity-[0.15] pointer-events-none'>
      <div
        className='absolute'
        style={{
          left: -cellX / 2 - pad * cellX,
          top: -cellY / 2 - pad * cellY,
          width: cols * cellX,
          color: tint,
          transform: 'rotate(-8deg)',
          transformOrigin: 'center'
        }}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className='flex'
            style={{
              height: cellY,
              // stagger alternating rows by half an icon width (brick layout)
              marginLeft: r % 2 === 1 ? iconSize / 2 : 0
            }}
          >
            {Array.from({ length: cols }, (_, c) => (
              <span key={c} className='flex items-center justify-center shrink-0' style={{ width: cellX, height: cellY }}>
                <GroupViewIcon view={view} className={iconClassName} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
