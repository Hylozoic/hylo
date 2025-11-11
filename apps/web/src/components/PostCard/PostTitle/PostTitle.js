import React from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheckBig } from 'lucide-react'
import { DateTime } from 'luxon'
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
  const { t } = useTranslation()

  // Formatting location to display in stream view
  const generalLocation = LocationHelpers.generalLocationString(locationObject, location || '')
  const trimmedLocation = (generalLocation || '').toString().trim()
  const looksLikeUrl = /^https?:\/\/\S+$/i.test(trimmedLocation) || /^www\./i.test(trimmedLocation)
  const normalizedUrl = looksLikeUrl
    ? (trimmedLocation.startsWith('http') ? trimmedLocation : `https://${trimmedLocation}`)
    : null

  return (
    <Highlight {...highlightProps}>
      <>
        <div onClick={onClick} className={cn('flex items-center text-xl font-bold', { [classes.constrained]: constrained, 'mb-1': type !== 'event' }, 'hdr-headline')}>
          {post.fulfilledAt && <span className='mr-1'><CircleCheckBig className='text-xl text-green-500' /></span>}
          {title}
        </div>
        {post.fulfilledAt && (
          <div className='flex items-center text-sm font-bold'>{t('Fulfilled at {{timestamp}}', { timestamp: DateTime.fromISO(post.fulfilledAt).toFormat('DD') })}</div>
        )}
        {location && (
          <div className={cn('text-xs text-foreground/50 flex items-center gap-1', { [classes.constrained]: constrained, 'mb-2': type !== 'event' })}>
            <Icon name='Location' className='w-4 h-4 text-foreground/50 text-xs' dataTestId='icon-Location' />
            {looksLikeUrl
              ? (
                <a
                  href={normalizedUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={(e) => e.stopPropagation()}
                >
                  {generalLocation}
                </a>
                )
              : generalLocation}
          </div>
        )}
      </>
    </Highlight>
  )
}
