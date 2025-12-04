import { ExternalLink } from 'lucide-react'
import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { cn } from 'util/index'

export default function MenuLink ({ badgeCount = null, to, children, onClick, externalLink, className, isEditing }) {
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
    return (
      <a href={externalLink} target='_blank' rel='noreferrer' onClick={onClick} className={cn('MenuLink text-foreground text-sm', className, { 'opacity-100 border-selected': isCurrentLocation })}>
        {children}
        {!isEditing && <ExternalLink className='w-4 h-4' />}
      </a>
    )
  }

  return (
    <Link to={to} onClick={handleClick} className={cn('text-foreground text-sm focus:text-foreground relative', className, { 'opacity-100 border-selected font-bold': isCurrentLocation }, { 'border-accent': badgeCount > 0 })}>
      {children}
      {badgeCount && badgeCount > 0
        ? (
          <span className='bg-accent rounded-full w-5 h-5 text-xs text-white font-bold text-xs absolute -top-2.5 -left-2.5 flex items-center justify-center'>{badgeCount}</span>
          )
        : null}
    </Link>
  )
}
