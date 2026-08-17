import { ExternalLink } from 'lucide-react'
import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { cn } from 'util/index'

/** Returns true when pathname matches the link target or a nested route under it. */
function isPathActive (pathname, to) {
  if (!to) return false
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function MenuLink ({ badgeCount = null, to, children, onClick, externalLink, className, isEditing, isActive, style, onMouseEnter, onMouseLeave, keepNavOpen = false, ...rest }) {
  const dispatch = useDispatch()
  const location = useLocation()
  const isCurrentLocation = isActive ?? isPathActive(location.pathname, to)

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick()
    }
    // Space drill-in stays in the drawer so the space's menu is visible
    // instead of closing onto the home view.
    if (!keepNavOpen) {
      dispatch(toggleNavMenu(false))
    }
  }, [onClick, keepNavOpen, dispatch])

  if (externalLink) {
    // focus:text-foreground matches the internal Link below — an external link
    // keeps focus after the jump, and without the pin the row comes back from
    // the other tab wearing the global link-focus green
    return (
      <a href={externalLink} target='_blank' rel='noreferrer' onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={style} className={cn('MenuLink text-foreground focus:text-foreground visited:text-foreground', className, { 'opacity-100 border-selected': isCurrentLocation })}>
        {children}
        {!isEditing && <ExternalLink className='w-4 h-4' />}
      </a>
    )
  }

  return (
    <Link to={to} onClick={handleClick} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={cn('text-foreground focus:text-foreground relative p-1 pl-2 rounded-md', className, { 'opacity-100 border-selected p-1 pl-2 rounded-md bg-card/100 font-bold': isCurrentLocation })} {...rest}>
      {children}
      {badgeCount && badgeCount > 0
        ? (
          <span className='bg-accent rounded-full w-5 h-5 text-xs text-white font-bold text-xs absolute right-[6px] flex items-center justify-center'>{badgeCount}</span>
          )
        : null}
    </Link>
  )
}
