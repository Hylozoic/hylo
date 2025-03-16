import React from 'react'
import { LocationHelpers } from '@hylo/shared'
import Highlight from 'components/Highlight'
import { cn } from 'util/index'
import Icon from 'components/Icon'
import classes from './PostTitle.module.scss'

export default function PostTitle ({
  constrained,
  highlightProps,
  locationObject,
  location,
  onClick,
  title,
  type,
  ...post
}) {
  // Formatting location to display in stream view
  const generalLocation = LocationHelpers.generalLocationString(locationObject, location || '')

  return (
    <Highlight {...highlightProps}>
      <>
        <div onClick={onClick} className={cn('text-xl font-bold', { [classes.constrained]: constrained, 'mb-2': type !== 'event' }, 'hdr-headline')} data-testid='post-title'>{title}</div>
        {type !== 'event' && location && (
          <div className={cn('text-xs text-foreground/50 flex items-center gap-0', { [classes.constrained]: constrained })}>
            <Icon name='Location' className='w-4 h-4 text-foreground/50' dataTestId='icon-Location' />
            {generalLocation}
          </div>
        )}
      </>
    </Highlight>
  )
}
