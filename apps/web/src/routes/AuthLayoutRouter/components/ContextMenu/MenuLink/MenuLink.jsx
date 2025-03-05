import React, { useCallback, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation } from 'react-router-dom'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { cn } from 'util/index'

export default function MenuLink ({ badgeCount = null, to, children, onClick, externalLink, className }) {
  const dispatch = useDispatch()
  const location = useLocation()
  const isCurrentLocation = location.pathname === to
  const linkRef = useRef(null)

  // Scroll active link into view when component mounts or active route changes
  useEffect(() => {
    if (isCurrentLocation && linkRef.current) {
      // Using a slight delay to ensure DOM is fully rendered
      setTimeout(() => {
        linkRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 150)
    }
  }, [isCurrentLocation])

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
      <a
        href={url}
        target='_blank'
        rel='noreferrer'
        onClick={onClick}
        ref={isCurrentLocation ? linkRef : null}
        className={cn('MenuLink text-foreground text-sm', className,
          { 'opacity-100 border-selected bg-background': isCurrentLocation })}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      to={to}
      onClick={handleClick}
      ref={isCurrentLocation ? linkRef : null}
      className={cn('text-foreground text-sm focus:text-foreground relative', className,
        { 'opacity-100 border-selected bg-background': isCurrentLocation })}
    >
      {children}
      {badgeCount && badgeCount > 0
        ? (
          <span className='bg-accent rounded-full w-4 h-4 text-xs text-white p-3 absolute -top-2 -right-2 flex items-center justify-center'>{badgeCount}</span>
          )
        : null}
    </Link>
  )
}
