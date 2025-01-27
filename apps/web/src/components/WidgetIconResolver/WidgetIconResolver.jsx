import React from 'react'
import Avatar from 'components/Avatar'
import { Grid3x3 } from 'lucide-react'
import Icon from 'components/Icon'
import { ViewHelpers } from '@hylo/shared'

export function WidgetIconResolver ({ widget, style, className }) {
  if (!widget) return null
  const type = widget.type

  if (widget.viewUser) {
    return <Avatar avatarUrl={widget.viewUser.avatarUrl} name={widget.viewUser.name} small style={style} className={className} />
  }

  if (widget.viewGroup) {
    return <Avatar avatarUrl={widget.viewGroup.avatarUrl} name={widget.viewGroup.name} small style={style} className={className} />
  }

  if (widget.customView?.icon) {
    return <Icon name={widget.customView.icon} style={style} className={className} />
  }

  if (widget.icon) {
    return <Icon name={widget.icon} style={style} className={className} />
  }

  if (widget.context === 'my') {
    return null
  }

  if (ViewHelpers.COMMON_VIEWS[type]) {
    return <Icon name={ViewHelpers.COMMON_VIEWS[type].icon} style={style} className={className}  />
  }

  switch (type) {
    case 'setup':
      return <Icon name='Settings' style={style} />
    case 'custom-views':
      return <Icon name='Stack' style={style} />
    case 'chats':
    case 'viewChat':
    case 'chat':
      return <Icon name='Message' style={style} />
    case 'viewPost':
      return <Icon name='Posticon' style={style} />
    case 'about':
      return <Icon name='Info' style={style} />
    case 'all-views':
      return <Grid3x3 className='h-[16px] inline-block' />
  }
  return null
}

export default WidgetIconResolver
