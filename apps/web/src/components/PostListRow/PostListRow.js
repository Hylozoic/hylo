import { getLocaleFromLocalStorage } from 'util/locale'
import { DateTimeHelpers, TextHelpers } from '@hylo/shared'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Icon from 'components/Icon'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'

/**
 * Gmail-style post list row with 3-column layout
 * Column 1: Creator name + post type
 * Column 2: Title + comments pill, then truncated details
 * Column 3: Timestamp
 */
const PostListRow = (props) => {
  const {
    currentGroupId,
    post,
    expanded
  } = props

  const {
    title,
    details,
    creator,
    createdTimestamp,
    commentsTotal
  } = post

  const { t } = useTranslation()
  const viewPostDetails = useViewPostDetails()

  if (!creator) {
    return null
  }

  const typeLowercase = post.type.toLowerCase()
  const typeName = post.type.charAt(0).toUpperCase() + typeLowercase.slice(1)
  const unread = false
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)

  // For events, show the date range
  const start = DateTimeHelpers.toDateTime(post.startTime, { locale: getLocaleFromLocalStorage() })
  const end = DateTimeHelpers.toDateTime(post.endTime, { locale: getLocaleFromLocalStorage() })
  const isSameDay = DateTimeHelpers.isSameDay(start, end)
  const eventDateDisplay = post.type === 'event'
    ? (isSameDay ? start.toFormat('MMM d') : `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}`)
    : null

  return (
    <div
      className={cn(
        'grid grid-cols-[160px_1fr_auto] gap-3 items-start',
        'bg-card hover:scale-102 transition-all shadow-sm hover:shadow-lg hover:shadow-foreground/10 border-2 border-transparent hover:border-foreground/50 rounded-md',
        'px-4 py-3 border-b-2 border-b-background cursor-pointer',
        {
          'bg-card font-semibold': unread,
          'opacity-60': isFlagged && !post.clickthrough
        },
        expanded && 'bg-card'
      )}
      onClick={() => viewPostDetails(post)}
    >
      {/* Column 1: Creator name + Post type */}
      <div className='flex flex-col min-w-0'>
        <span className={cn('text-base text-foreground truncate font-bold', { 'font-bold': unread })}>
          {creator.name}
        </span>
        <div className='flex items-center gap-1 text-xs text-foreground/50'>
          <Icon name={typeName} className='w-3 h-3' />
          <span className='capitalize'>{typeLowercase}</span>
        </div>
      </div>

      {/* Column 2: Title + comments, then details or event date */}
      <div className='flex flex-col min-w-0'>
        <div className='flex items-center gap-2'>
          {isFlagged && <Icon name='Flag' className='w-3 h-3 text-destructive shrink-0' />}
          <span className={cn('text-base text-foreground truncate font-bold', { 'font-bold': unread })}>
            {title}
          </span>
          {commentsTotal > 0
            ? (
              <span className='shrink-0 text-[10px] bg-foreground/10 text-foreground/70 px-1.5 py-0.5 rounded-full'>
                {commentsTotal} {commentsTotal === 1 ? t('comment') : t('comments')}
              </span>
              )
            : ' '}
        </div>
        {eventDateDisplay
          ? (
            <span className='text-xs text-foreground/70'>
              <Icon name='Calendar' className='w-3 h-3 inline mr-1' />
              {eventDateDisplay}
            </span>
            )
          : (
            <span className='text-xs text-foreground/50 line-clamp-1'>
              {TextHelpers.presentHTMLToText(details, { truncate: 150 })}
            </span>
            )}
      </div>

      {/* Column 3: Timestamp */}
      <div className='text-xs text-foreground/50 whitespace-nowrap h-full flex items-center'>
        {createdTimestamp}
      </div>
    </div>
  )
}

export default PostListRow
