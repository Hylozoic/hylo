import React from 'react'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import { widgetTypeResolver } from 'util/contextWidgets'

export function WidgetIconResolver ({ widget, style, className }) {
  const type = widgetTypeResolver({ widget })

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

  switch (type) {
    case 'chats':
      return <Icon name='Message' style={style} />
    case 'members':
      return <Icon name='People' style={style} />
    case 'groups':
      return <Icon name='Groups' style={style} />
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
    case 'discussions':
      return <Icon name='Message' style={style} />
    case 'ask-and-offer':
      return <Icon name='Request' style={style} />
    case 'stream':
      return <Icon name='Stream' style={style} />
    case 'events':
      return <Icon name='Calendar' style={style} />
    case 'projects':
      return <Icon name='Stack' style={style} />
    case 'proposals':
    case 'decisions':
      return <Icon name='Proposal' style={style} />
    case 'about':
      return <Icon name='Info' style={style} />
    case 'map':
      return <Icon name='Globe' style={style} />
  }
  return null
}

export default WidgetIconResolver
