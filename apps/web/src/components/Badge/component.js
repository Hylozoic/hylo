import { cn } from 'util/index'
import React from 'react'
import classes from './component.module.scss'

export default function Badge ({ number, expanded, className, border, onClick }) {
  if (!number) return null
  return (
    <span className={cn(classes.badgeWrapper, className)} onClick={onClick} role='status'>
      <span className={cn(expanded ? classes.badge : classes.badgeCollapsed, { [classes.border]: border })}>
        {number === '-'
          ? <span className='w-3 h-3 bg-white rounded-full' />
          : <span className={expanded ? classes.badgeNumber : classes.badgeNumberCollapsed}>{number}</span>}
      </span>
    </span>
  )
}
