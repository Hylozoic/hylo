import React from 'react'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import LucideIcon, { CustomIcons } from 'components/LucideIcon/LucideIcon'

export function WidgetIconResolver ({
  className,
  dimension,
  iconName: providedIconName,
  size,
  style = { fontSize: 18 },
  widget
}) {
  const iconName = widget?.iconName || providedIconName

  if (!widget && !iconName) return null

  if (widget?.avatarUrl) {
    return (
      <Avatar
        avatarUrl={widget.avatarUrl}
        name={widget?.displayName}
        style={style}
        className={className}
        dimension={size || style?.fontSize + 6}
      />
    )
  }

  if (iconName) {
    return CustomIcons[iconName]
      ? <LucideIcon
          className={className}
          name={iconName}
          size={style?.fontSize}
          style={style}

        />
      : <Icon
          className={className} 
          name={iconName}
          size={size}
          style={style}
        />
  }

  return null
}

export default WidgetIconResolver
