import { ChevronRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { DateTimeHelpers } from '@hylo/shared'
import { POST_TYPES } from '@hylo/presenters/PostPresenter'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { getPostTypeIcon } from 'store/models/Post'
import { cn } from 'util/index'

/**
 * Inline notice when a non-chat post is created in a group chat room.
 * Sinks into the page (no elevation): bordered, with a postType-colored
 * accent bar and header, per the chat design.
 */
export default function ChatPostNotice ({ post, highlighted, className }) {
  const { t } = useTranslation()
  const viewPostDetails = useViewPostDetails()
  const { commentsTotal, creator, startTime, endTime, timezone, title, type } = post

  const postTypeLabel = t(type)
  const accent = POST_TYPES[type]?.primaryColor || POST_TYPES.discussion.primaryColor
  const timeRange = startTime
    ? DateTimeHelpers.formatDatePair({ start: startTime, end: endTime, timezone })
    : null

  const handleClick = () => viewPostDetails(post)

  return (
    <div
      className={cn(
        'w-fit max-w-full sm:max-w-[520px] flex flex-col gap-1 rounded-lg pl-3 pr-5 py-2.5 cursor-pointer bg-darkening/20 border border-foreground/10 transition-colors hover:border-foreground/25',
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
      <div className='flex items-center gap-2 min-w-0'>
        <Avatar avatarUrl={creator?.avatarUrl} small className='shrink-0' />
        <Icon name={getPostTypeIcon(type)} className='text-sm shrink-0' style={{ color: accent }} />
        <span className='text-xs font-bold uppercase tracking-wide truncate' style={{ color: accent }}>
          {t('{{author}} posted a new {{postType}}', { author: creator?.name, postType: postTypeLabel })}
        </span>
      </div>
      {title && (
        <div className='font-bold text-foreground truncate'>"{title}"</div>
      )}
      <div className='w-full flex items-center gap-3 min-w-0'>
        {(commentsTotal > 0 || timeRange) && (
          <span className='text-sm text-foreground/60 truncate'>
            {commentsTotal > 0 && <>{commentsTotal} {commentsTotal === 1 ? t('reply') : t('replies')}</>}
            {commentsTotal > 0 && timeRange && ' · '}
            {timeRange}
          </span>
        )}
        <span className='ml-auto flex items-center gap-0.5 text-sm font-semibold text-selected shrink-0'>
          {t('Open')}
          <ChevronRight className='w-4 h-4' />
        </span>
      </div>
    </div>
  )
}
