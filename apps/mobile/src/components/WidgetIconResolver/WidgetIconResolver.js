import React from 'react'
import FastImage from 'react-native-fast-image'
import Icon from 'components/Icon'
import Avatar from 'components/Avatar'
import { ViewHelpers, WidgetHelpers } from '@hylo/shared'
const { widgetTypeResolver } = WidgetHelpers

export function WidgetIconResolver({ widget, style, className }) {
  const type = widgetTypeResolver({ widget })

  if (widget.icon) {
    return <Icon name={widget.icon} style={style} className={className} />
  }

  if (widget.viewUser) {
    return (
      <Avatar 
        avatarUrl={widget.viewUser.avatarUrl} 
        name={widget.viewUser.name}
        style={style}
        className={className}
      />
    )
  }

  if (widget.viewGroup) {
    return (
      <Avatar 
        avatarUrl={widget.viewGroup.avatarUrl} 
        name={widget.viewGroup.name}
        style={style}
        className={className}
      />
    )
  }

  if (widget.customView?.icon) {
    return <Icon name={widget.customView.icon} style={style} className={className} />
  }

  if (widget.context === 'my') {
    return null
  }

  if (ViewHelpers.COMMON_VIEWS[type]) {
    return <Icon name={ViewHelpers.COMMON_VIEWS[type].icon} style={style} />
  }

  switch (type) {
    case 'chats':
      return <Icon name='Message' style={style} />
    case 'setup':
      return <Icon name='Settings' style={style} />
    case 'custom-views':
      return <Icon name='Stack' style={style} />
    case 'viewChat':
      return <Icon name='Message' style={style} />
    case 'chat':
      return <Icon name='Message' style={style} />
    case 'viewPost':
      return <Icon name='Posticon' style={style} />
    case 'about':
      return <Icon name='Info' style={style} />
  }
  return null
}

export default WidgetIconResolver
