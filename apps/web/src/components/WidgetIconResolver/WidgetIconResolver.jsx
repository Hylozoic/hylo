import React from 'react'
import { Grid3x3, Shapes, BadgeDollarSign } from 'lucide-react'
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
    return widget.iconName === 'Grid3x3'
      ? <Grid3x3 className='h-[16px] inline-block' />
      : widget.iconName === 'Shapes'
        ? <Shapes className='h-[16px] w-[16px] inline-block' />
        : widget.iconName === 'BadgeDollarSign'
          ? <BadgeDollarSign className='h-[16px] w-[16px] inline-block' />
          : <Icon name={widget.iconName} style={style} className={className} />
  }

  return null
}

export default WidgetIconResolver
