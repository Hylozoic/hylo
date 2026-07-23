import React, { useMemo } from 'react'
import GroupViewIcon from './GroupViewIcon'

/**
 * Icon-as-pattern card background: the card's own glyph repeated as a rotated
 * grid of "pixels", with alternating rows offset by half an icon width for a
 * staggered brick layout. Opacity varies 0.1–0.8 across the field via layered
 * sine waves so it reads as an organic texture; `seed` shifts the phase and
 * frequency so every card gets a distinct pattern. The grid is offset half a
 * cell and padded so icons bleed off all four edges, and the whole field
 * renders at half opacity to stay behind the card content.
 */
export default function CardIconField ({ view, tint, w, h, cell = 17, iconSize = 12, iconClassName = '!w-3 !h-3 !mr-0', seed = 0 }) {
  const { rows, cols, cellX, cellY, pad } = useMemo(() => {
    const fx = 0.6 + (seed % 5) * 0.2
    const fy = 0.45 + ((seed >> 1) % 5) * 0.18
    const px = (seed % 7) * 0.9
    const py = (seed % 4) * 1.1
    const nx = Math.max(1, Math.round(w / cell))
    const ny = Math.max(1, Math.round(h / cell))
    const cellX = w / nx
    const cellY = h / ny
    const pad = 3
    const cols = nx + 1 + pad * 2
    const rowCount = ny + 1 + pad * 2
    const rows = []
    for (let r = 0; r < rowCount; r++) {
      const opacities = []
      for (let c = 0; c < cols; c++) {
        const v = (Math.sin(c * fx + r * 0.4 + px) + Math.cos(r * fy - c * 0.32 + py) + Math.sin((c + r) * 0.55 + seed)) / 3
        opacities.push(0.1 + 0.7 * ((v + 1) / 2))
      }
      rows.push(opacities)
    }
    return { rows, cols, cellX, cellY, pad }
  }, [seed, w, h, cell])

  return (
    <div aria-hidden='true' className='absolute inset-0 overflow-hidden opacity-50 pointer-events-none'>
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
        {rows.map((opacities, r) => (
          <div
            key={r}
            className='flex'
            style={{
              height: cellY,
              // stagger alternating rows by half an icon width (brick layout)
              marginLeft: r % 2 === 1 ? iconSize / 2 : 0
            }}
          >
            {opacities.map((opacity, c) => (
              <span key={c} className='flex items-center justify-center shrink-0' style={{ width: cellX, height: cellY, opacity }}>
                <GroupViewIcon view={view} className={iconClassName} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
