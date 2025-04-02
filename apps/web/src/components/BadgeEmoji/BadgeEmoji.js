import React from 'react'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'
import classes from './badgeEmoji.module.scss'

export default function Badge ({ emoji, expanded, className, common, border, onClick, name, id, responsibilities = [] }) {
  if (!emoji) return null

  // TODO: why is this items?
  responsibilities = responsibilities?.items ? responsibilities.items : responsibilities

  // XXX: hacky way to determine if this is an important system role, having a responsibilit of Administration, Manage Content, or Remove Members
  common = common || responsibilities.find(r => ['1', '3', '4'].includes(r.id))

  return (
    <>
      <span
        className={cn(
          className,
          expanded ? 'border-2 border-selected/20 p-[1px] rounded-sm bg-selected/10 text-xs hover:cursor-pointer hover:bg-selected/30 hover:border-selected/40 hover:scale-105 transition-all' : classes.badgeCollapsed,
          { [classes.border]: border, 'bg-focus/10 border-focus/20 hover:bg-focus/30 hover:border-focus/40': common }
        )}
        onClick={onClick}
        data-tooltip-id={`${id}-${name}-badge-tt`}
      >
        <span className={expanded ? 'text-xs' : classes.badgeSymbolCollapsed}>{emoji}</span>
      </span>
      <Tooltip
        delay={150}
        position='bottom'
        id={`${id}-${name}-badge-tt`}
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
      />
    </>
  )
}
