import React from 'react'
import { Link } from 'react-router-dom'

export default function NavLink ({ to, children, onClick, externalLink }) {
  if (externalLink) {
    return (
      <a href={externalLink} target='_blank' rel='noreferrer' onClick={onClick}>
        {children}
      </a>
    )
  }

  return (
    <Link to={to} onClick={onClick}>
      {children}
    </Link>
  )
}
