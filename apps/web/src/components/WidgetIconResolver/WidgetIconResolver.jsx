import React from 'react'
import Avatar from 'components/Avatar'
import { Grid3x3 } from 'lucide-react'
import Icon from 'components/Icon'
import ContextWidgetPresenter from '@hylo/presenters/ContextWidgetPresenter'

export function WidgetIconResolver ({ widget: providedWidget, style, className }) {
  if (!providedWidget) return null

  const widget = ContextWidgetPresenter(providedWidget, {})

  if (widget?.avatarUrl) {
    return <Avatar avatarUrl={widget.avatarUrl} name={widget?.displayName} small style={style} className={className} />
  }

  if (widget?.iconName) {
    return widget.iconName === 'Grid3x3'
      ? <Grid3x3 className='h-[16px] inline-block' />
      : <Icon name={widget.iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
