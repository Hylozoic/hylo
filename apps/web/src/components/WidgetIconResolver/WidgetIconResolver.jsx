import React from 'react'
import Avatar from 'components/Avatar'
import { Grid3x3 } from 'lucide-react'
import Icon from 'components/Icon'
import ContextWidgetPresenter from '@hylo/presenters/ContextWidgetPresenter'

export function WidgetIconResolver ({ widget, style, className }) {
  if (!widget) {
    console.warn('No widget passed into WidgetIconResolver')
    return null
  }

  // Transform widget data using ContextWidgetPresenter
  const processedWidget = ContextWidgetPresenter(widget, {})

  const { iconName, avatarUrl, displayName } = processedWidget

  if (avatarUrl) {
    return <Avatar avatarUrl={avatarUrl} name={displayName} small style={style} className={className} />
  }

  if (iconName) {
    return iconName === 'Grid3x3'
      ? <Grid3x3 className='h-[16px] inline-block' />
      : <Icon name={iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
