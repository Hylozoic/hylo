import React from 'react'
import { cn } from 'util'
import { Link } from 'react-router-dom'

export default function MenuLink ({ to, children, onClick, externalLink }) {
  if (externalLink) {
    const url = externalLink.startsWith('http://') || externalLink.startsWith('https://')
      ? externalLink
      : `https://${externalLink}`

    return (
      <a href={url} target='_blank' rel='noreferrer' onClick={onClick} className='text-foreground text-sm'>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} onClick={onClick} className='text-foreground text-sm'>
      {children}
    </Link>
  )
}
