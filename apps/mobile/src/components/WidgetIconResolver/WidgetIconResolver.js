import React from 'react'
import FastImage from 'react-native-fast-image'
import Icon from 'components/Icon'
import { Grid3x3 } from 'lucide-react-native'
import Avatar from 'components/Avatar'
import { ViewHelpers } from '@hylo/shared'

export function WidgetIconResolver({ widget, style, className }) {
  if (!widget) {
    console.warn('No widget passed into iconResolver')
    return null
  }
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
    return <Icon name={ViewHelpers.COMMON_VIEWS[type].icon} style={style} className={className} />
  }

  // TODO redesign: - make a iconName method in WidgetHelpers / WidgetPresenter
  // the name icon name is shared by web mobile?
  // TOM COMMENT: waiting for full shake-out of Lucide transition before cleaning this up
  switch (type) {
    case 'chats':
      return <Icon name='Message' style={style} className={className} />
    case 'setup':
      return <Icon name='Settings' style={style} className={className} />
    case 'custom-views':
      return <Icon name='Stack' style={style} className={className} />
    case 'viewChat':
      return <Icon name='Message' style={style} className={className} />
    case 'chat':
      return <Icon name='Message' style={style} className={className} />
    case 'viewPost':
      return <Icon name='Posticon' style={style} className={className} />
    case 'about':
      return <Icon name='Info' style={style} className={className} />
    case 'all-views':
      return <Grid3x3 className='h-[16px]'/>
  }
  return null
}

export default WidgetIconResolver