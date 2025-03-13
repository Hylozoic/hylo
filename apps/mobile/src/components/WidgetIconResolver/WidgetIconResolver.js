import React from 'react'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import LucideIcon, { CustomIcons } from 'components/LucideIcon/LucideIcon'

export function WidgetIconResolver ({ widget, style, className }) {
  if (!widget) return null

  if (widget?.avatarUrl) {
    return <Avatar avatarUrl={widget.avatarUrl} name={widget?.displayName} style={style} className={className} />
  }

  if (widget?.iconName) {
    return CustomIcons[widget.iconName]
      ? <LucideIcon name={widget.iconName} style={style} className={className} />
      : <Icon name={widget.iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
