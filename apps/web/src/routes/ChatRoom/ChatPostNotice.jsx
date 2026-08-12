import { ChevronRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatUserDatePair } from 'util/dateFormat'
import { POST_TYPES } from '@hylo/presenters/PostPresenter'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import useAppearance from 'hooks/useAppearance'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { getPostTypeIcon } from 'store/models/Post'
import { cn } from 'util/index'

/**
 * Inline notice when a non-chat post is created in a group chat room.
 * Sinks into the page (no elevation): bordered, with a postType-tinted
 * surface and header, per the chat design.
 */
export default function ChatPostNotice ({ post, highlighted, className }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const viewPostDetails = useViewPostDetails()
  const { commentsTotal, creator, startTime, endTime, timezone, title, type } = post

  const postTypeLabel = t(type)
  const accent = POST_TYPES[type]?.primaryColor || POST_TYPES.discussion.primaryColor
  const timeRange = startTime
    ? formatUserDatePair({ start: startTime, end: endTime, timezone })
    : null

  const handleClick = () => viewPostDetails(post)

  // Light mode gets a faint wash of the post type color instead of a neutral
  // darkening, which read as a flat grey against the pale chat pane.
  const surface = isDark
    ? 'hsl(var(--darkening) / 0.2)'
    : `color-mix(in srgb, ${accent} 8%, transparent)`

  return (
    <div
      className={cn(
        // A single left rule rather than a box — the card sits in a stream, so one
        // edge is enough to bound it and the four-sided border only added weight.
        'group w-fit max-w-full sm:max-w-[520px] flex flex-col gap-1 rounded-lg pl-3 pr-5 py-2.5 cursor-pointer border-0 border-l-2 border-l-foreground/20 transition-all hover:scale-105',
        { 'bg-accent/30': highlighted },
        className
      )}
      style={highlighted ? undefined : { background: surface }}
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
        {/* Only the type — icon and word together — carries the type colour; the
            sentence around it stays neutral. Split the translated sentence around a
            sentinel so every locale's word order survives (German and Hindi both
            put words after the type). */}
        <span className='text-xs font-bold uppercase tracking-wide truncate text-foreground/70'>
          {(() => {
            const SENTINEL = '\u241F'
            const [before, after] = t('{{author}} posted a new {{postType}}', { author: creator?.name, postType: SENTINEL }).split(SENTINEL)
            return (
              <>
                {before}
                {/* mx breathes on both sides — the sentence's own spaces around the
                    splice render vanishingly small at this size and tracking */}
                <span className='inline-flex items-baseline gap-1 mx-1 whitespace-nowrap' style={{ color: accent }}>
                  <Icon name={getPostTypeIcon(type)} className='text-sm' />
                  {postTypeLabel}
                </span>
                {after}
              </>
            )
          })()}
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
        <span className='ml-auto flex items-center gap-0.5 text-sm font-semibold text-selected shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150'>
          {t('Open')}
          <ChevronRight className='w-4 h-4' />
        </span>
      </div>
    </div>
  )
}
