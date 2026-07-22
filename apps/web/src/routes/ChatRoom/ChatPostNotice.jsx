import React from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { getPostTypeIcon } from 'store/models/Post'
import { cn } from 'util/index'

/** Minimal inline notice when a non-chat post is created in a group chat room. */
export default function ChatPostNotice ({ post, highlighted, className }) {
  const { t } = useTranslation()
  const viewPostDetails = useViewPostDetails()
  const { creator, startTime, endTime, timezone, title, type } = post

  const postTypeLabel = t(type)
  const timeRange = startTime
    ? DateTimeHelpers.formatDatePair({ start: startTime, end: endTime, timezone })
    : null

  const handleClick = () => viewPostDetails(post)

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg px-3 py-3 cursor-pointer bg-card shadow-lg border-2 border-transparent hover:border-foreground/50 transition-all',
        { 'bg-accent/30': highlighted },
        className
      )}
      onClick={handleClick}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Avatar avatarUrl={creator?.avatarUrl} large className='shrink-0' />
      <div className='flex flex-col gap-0.5 min-w-0'>
        <div className='flex items-center gap-1.5 text-sm text-foreground/80'>
          <Icon name={getPostTypeIcon(type)} className='text-sm shrink-0' />
          <span className='truncate'>
            {t('{{author}} posted a new {{postType}}', { author: creator?.name, postType: postTypeLabel })}
          </span>
        </div>
        {title && (
          <div className='font-medium text-foreground truncate'>{title}</div>
        )}
        {timeRange && (
          <div className='text-sm text-foreground/60'>{timeRange}</div>
        )}
      </div>
    </div>
  )
}
