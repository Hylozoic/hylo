import React from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'
import classes from './badgeEmoji.module.scss'

export default function Badge ({ emoji, expanded, className, common, border, onClick, name, id, showName = false, responsibilities = [] }) {
  if (!emoji) return null

  // TODO: why is this items?
  responsibilities = responsibilities?.items ? responsibilities.items : responsibilities

  // XXX: hacky way to determine if this is an important system role, having a responsibilit of Administration, Manage Content, or Remove Members
  common = common || responsibilities.find(r => ['1', '3', '4'].includes(r.id))

  const tooltipId = `${id}-${name}-badge-tt`

  const tooltipContent = (
    <Tooltip
      delay={150}
      position='bottom'
      id={tooltipId}
      content={() => (
        <div className={classes.tipContent}>
          <span>{name}</span>
          {responsibilities.length > 0 && (
            <ul>
              {responsibilities.map(r => (
                <li key={r.id}>{r.title}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      className='!z-[9999]'
    />
  )

  return (
    <>
      <span
        className={cn(
          className,
          // Neutral, desaturated chip per the style guide: a quiet surface behind
          // the emoji that reads in both themes, border unsaturated
          expanded
            ? cn(
              'inline-flex items-center gap-1 py-0.5 rounded-full text-xs bg-foreground/10 border border-foreground/15 hover:cursor-pointer hover:bg-foreground/20 hover:border-foreground/25 hover:scale-105 transition-all',
              showName && name ? 'px-1.5' : 'px-1'
            )
            : classes.badgeCollapsed,
          { [classes.border]: border }
        )}
        onClick={onClick}
        data-tooltip-id={tooltipId}
        data-tooltip-position-strategy='fixed'
      >
        <span
          className={cn(
            // Emoji are fixed-color glyphs, so contrast comes from size and a
            // silhouette: a notch larger than the label, with a theme-aware
            // halo so thin glyphs (🪄) read on light and dark chips alike
            expanded ? 'text-sm leading-none' : classes.badgeSymbolCollapsed,
            '[filter:drop-shadow(0_0.5px_1px_rgba(0,0,0,0.35))] dark:[filter:drop-shadow(0_0_1.5px_rgba(255,255,255,0.45))]'
          )}
        >
          {emoji}
        </span>
        {expanded && showName && name && (
          <span className='text-xs leading-none text-foreground/80 whitespace-nowrap'>{name}</span>
        )}
      </span>
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  )
}
