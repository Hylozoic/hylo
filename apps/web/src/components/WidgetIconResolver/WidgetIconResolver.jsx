import React from 'react'
import { ContextWidgetPresenter } from '@hylo/presenters'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'

export function WidgetIconResolver ({ widget: providedWidget, style, className }) {
  if (!providedWidget) return null

  const widget = ContextWidgetPresenter(providedWidget)

  if (widget?.avatarUrl) {
    return <Avatar avatarUrl={widget.avatarUrl} name={widget?.displayName} small style={style} className={className} />
  }

  if (widget?.iconName) {
    if (typeof widget.iconName === 'function' || React.isValidElement(widget.iconName)) {
      const IconComponent = widget.iconName
      return typeof IconComponent === 'function'
        ? <IconComponent className='h-[16px] w-[16px] inline-block' />
        : React.cloneElement(IconComponent, { className: 'h-[16px] w-[16px] inline-block' })
    }
    return <Icon name={widget.iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
