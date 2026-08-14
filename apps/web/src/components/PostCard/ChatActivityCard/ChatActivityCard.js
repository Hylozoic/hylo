import { ChevronRight, MessageSquareMore } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { DateTimeHelpers, TextHelpers } from '@hylo/shared'
import { groupUrl, localSpaceSlug, spaceUrl } from '@hylo/navigation'
import { useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import Tooltip from 'components/Tooltip'
import { getLocaleFromLocalStorage } from 'util/locale'
import { cn } from 'util/index'

const FULLY_VISIBLE_MESSAGES = 2

/**
 * Chat room URL for a chat_activity notice, scrolled to its newest message.
 * Space routes need the parent slug; pass it from the current URL when known.
 * @param {object} post
 * @param {string} [parentSlug]
 * @returns {string}
 */
export function chatUrlForActivityPost (post, parentSlug) {
  const targetGroup = post?.groups?.[0]
  if (!targetGroup) return '/'
  const newestId = post.noticePosts?.[0]?.id || post.noticeData?.recentPostIds?.[0]
  const query = newestId ? `?postId=${newestId}` : ''
  if (targetGroup.type === 'space' && parentSlug) {
    const local = localSpaceSlug(parentSlug, targetGroup.slug)
    return `${spaceUrl(parentSlug, local, '/chat')}${query}`
  }
  return `${groupUrl(targetGroup.slug, 'chat')}${query}`
}

/** Compact All Activity card summarizing an hour of chat in a group or space. */
export default function ChatActivityCard ({
  className,
  post
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { parentGroupSlug, groupSlug } = useGroupRouteOpts()
  const targetGroup = post?.groups?.[0]
  const groupName = targetGroup?.name || ''
  const parentSlug = parentGroupSlug || groupSlug
  const chatUrl = useMemo(() => chatUrlForActivityPost(post, parentSlug), [post, parentSlug])
  const messages = post?.noticePosts || []
  const visible = messages.slice(0, FULLY_VISIBLE_MESSAGES)
  const faded = messages.slice(FULLY_VISIBLE_MESSAGES)
  const latestChatAt = messages[0]?.createdAt || post?.createdAt
  const timestamp = post?.createdTimestamp || (latestChatAt ? DateTimeHelpers.humanDate(latestChatAt) : null)
  const exactTimestamp = post?.exactCreatedTimestamp || (latestChatAt
    ? DateTimeHelpers.toDateTime(latestChatAt, { locale: getLocaleFromLocalStorage() }).toFormat('D t ZZZZ')
    : null)
  const dateTipId = `chat-activity-dateTip-${post?.id}`

  const handleOpen = useCallback(() => {
    navigate(chatUrl)
  }, [navigate, chatUrl])

  return (
    <div
      className={cn(
        'rounded-lg bg-card p-3 mb-2.5 cursor-pointer border border-foreground/10 hover:border-foreground/20',
        className
      )}
      data-testid='chat-activity-card'
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleOpen()
        }
      }}
      role='button'
      tabIndex={0}
    >
      <div className='flex items-center gap-2 mb-2'>
        <span className='flex items-center justify-center w-6 h-6 rounded bg-selected text-white shrink-0'>
          <MessageSquareMore className='w-3.5 h-3.5' />
        </span>
        <div className='flex-1 min-w-0 text-sm truncate'>
          <span className='uppercase tracking-wide text-foreground/50 text-xs font-semibold'>{t('CHAT ACTIVITY')}</span>
          {groupName && (
            <>
              <span className='text-foreground/50'> · </span>
              <span className='font-bold text-foreground'>{groupName}</span>
            </>
          )}
        </div>
        {timestamp && (
          <span
            className='text-foreground/50 text-2xs whitespace-nowrap shrink-0'
            data-tooltip-id={dateTipId}
            data-tooltip-content={exactTimestamp}
          >
            {timestamp}
          </span>
        )}
        <Link
          to={chatUrl}
          className='text-selected text-sm font-semibold shrink-0 flex items-center gap-0.5'
          onClick={(e) => e.stopPropagation()}
        >
          {t('Open')}
          <ChevronRight className='w-4 h-4' />
        </Link>
      </div>
      <div className='relative pl-3 flex flex-col gap-1 border-l-2 border-selected'>
        {visible.map(message => (
          <ChatActivityMessage key={message.id} post={message} />
        ))}
        {faded.length > 0 && (
          <div className='relative'>
            {faded.map(message => (
              <ChatActivityMessage key={message.id} post={message} faded />
            ))}
            <div className='absolute inset-0 bg-gradient-to-b from-transparent to-card pointer-events-none' />
          </div>
        )}
      </div>
      {exactTimestamp && (
        <Tooltip
          delay={550}
          id={dateTipId}
          position='left'
        />
      )}
    </div>
  )
}

/** One preview line: author name plus stripped chat text. */
function ChatActivityMessage ({ post, faded = false }) {
  const text = TextHelpers.presentHTMLToText(post.details || '', { truncate: 180 })
  return (
    <p className={cn('text-sm leading-snug m-0', faded ? 'opacity-40' : 'opacity-100')}>
      <span className='font-bold text-foreground'>{post.creator?.name}</span>
      <span className='text-foreground/70'>: {text}</span>
    </p>
  )
}
