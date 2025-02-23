import React from 'react'
import { Grid3x3 } from 'lucide-react-native'
import ContextWidgetPresenter from '@hylo/presenters/ContextWidgetPresenter'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'

export function WidgetIconResolver ({ widget: providedWidget, style, className }) {
  if (!providedWidget) return null

  const widget = ContextWidgetPresenter(providedWidget)

  if (widget?.avatarUrl) {
    return <Avatar avatarUrl={widget.avatarUrl} name={widget?.displayName} style={style} className={className} />
  }

  if (widget?.iconName) {
    return widget.iconName === 'Grid3x3'
      ? <Grid3x3 className='h-[16px]' />
      : <Icon name={widget.iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
