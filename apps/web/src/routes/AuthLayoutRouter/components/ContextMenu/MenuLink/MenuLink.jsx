import React, { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'

export default function MenuLink ({ to, children, onClick, externalLink }) {
  const dispatch = useDispatch()

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick()
    }
    dispatch(toggleNavMenu())
  }, [onClick])

  if (externalLink) {
    const url = externalLink.startsWith('http://') || externalLink.startsWith('https://')
      ? externalLink
      : `https://${externalLink}`

    return (
      <a href={url} target='_blank' rel='noreferrer' onClick={onClick} className='MenuLink text-foreground text-sm'>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} onClick={handleClick} className='text-foreground text-sm'>
      {children}
    </Link>
  )
}
