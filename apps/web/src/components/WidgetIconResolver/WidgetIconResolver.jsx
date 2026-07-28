import React from 'react'
import { ContextWidgetPresenter } from '@hylo/presenters'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'

export function WidgetIconResolver ({ widget: providedWidget, style, className }) {
  if (!providedWidget) return null

  const widget = ContextWidgetPresenter(providedWidget)

  if (widget?.avatarUrl) {
    return <Avatar avatarUrl={widget.avatarUrl} name={widget?.displayName} small style={style} className={className} />
  }

  if (widget?.iconName) {
    return (
      <LucideIcon
        name={widget.iconName}
        className={className || 'h-[16px] w-[16px] inline-block'}
        fallback={<Icon name={widget.iconName} style={style} className={className} />}
      />
    )
  }

  return null
}

export default WidgetIconResolver
