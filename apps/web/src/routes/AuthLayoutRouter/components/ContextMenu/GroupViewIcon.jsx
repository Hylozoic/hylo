import { BadgeDollarSign, ClipboardList, Shapes } from 'lucide-react'
import React from 'react'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'

/** Renders the icon or avatar for a presented GroupView menu item. */
export default function GroupViewIcon ({ view, className }) {
  if (!view) return null

  if (view.avatarUrl) {
    return (
      <Avatar
        avatarUrl={view.avatarUrl}
        name={view.avatarDisplayName}
        small
        className={className}
      />
    )
  }

  if (view.lucideIcon) {
    return (
      <LucideIcon
        name={view.lucideIcon}
        className={className || 'h-4 w-4 shrink-0 mr-1'}
        fallback={<Icon name={view.lucideIcon} className={className || 'h-4 w-4 shrink-0 mr-1'} />}
      />
    )
  }

  if (view.iconName === 'Shapes') {
    return <Shapes className={className || 'h-4 w-4 shrink-0 mr-1'} />
  }

  if (view.iconName === 'BadgeDollarSign') {
    return <BadgeDollarSign className={className || 'h-4 w-4 shrink-0 mr-1'} />
  }

  if (view.iconName === 'ClipboardList') {
    return <ClipboardList className={className || 'h-4 w-4 shrink-0 mr-1'} />
  }

  if (view.iconName) {
    return <Icon name={view.iconName} className={className || 'h-4 w-4 shrink-0 mr-1'} />
  }

  return null
}
