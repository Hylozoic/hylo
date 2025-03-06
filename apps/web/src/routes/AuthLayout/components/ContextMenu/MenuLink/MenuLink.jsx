import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { toggleNavMenu } from 'routes/AuthLayout/AuthLayout.store'
import { cn } from 'util/index'

export default function MenuLink ({ badgeCount = null, to, children, onClick, externalLink, className }) {
  const dispatch = useDispatch()
  const location = useLocation()
  const isCurrentLocation = location.pathname === to

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick()
    }
    dispatch(toggleNavMenu(false))
  }, [onClick])

  if (externalLink) {
    const url = externalLink.startsWith('http://') || externalLink.startsWith('https://')
      ? externalLink
      : `https://${externalLink}`

    return (
      <a href={url} target='_blank' rel='noreferrer' onClick={onClick} className={cn('MenuLink text-foreground text-sm', className, { 'opacity-100 border-selected': isCurrentLocation })}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} onClick={handleClick} className={cn('text-foreground text-sm focus:text-foreground relative', className, { 'opacity-100 border-selected': isCurrentLocation })}>
      {children}
      {badgeCount && badgeCount > 0
        ? (
          <span className='bg-accent rounded-full w-4 h-4 text-xs text-white p-3 absolute -top-2 -right-2 flex items-center justify-center'>{badgeCount}</span>
          )
        : null}
    </Link>
  )
}
