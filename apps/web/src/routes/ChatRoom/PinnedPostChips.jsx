import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { TextHelpers } from '@hylo/shared'
import pinPost from 'store/actions/pinPost'
import { cn } from 'util/index'

/** The tilted pin glyph from the design. */
export function PinGlyph ({ size = 12, className }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' className={className} aria-hidden='true'>
      <path d='M14 2l1 5 4 3-1 2-5-1-4 6-1-1 4-6-3-4 2-1 3-4z' transform='rotate(15 12 12)' />
    </svg>
  )
}

function chipTitle (post) {
  if (post.title) return post.title
  const text = TextHelpers.presentHTMLToText(post.details || '', { truncate: 64 })
  return text || 'Post'
}

/**
 * One pinned-post chip: pin glyph + truncated title, tinted to the post type.
 * Click opens the post; hovering reveals Unpin for content moderators.
 */
function PinnedChip ({ post, canModerate, onOpen, onUnpin, t }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className='relative inline-flex shrink-0'
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Gold-on-card, matching the stream's pinned treatment */}
      <button
        type='button'
        onClick={onOpen}
        title={chipTitle(post)}
        className='inline-flex items-center gap-1.5 h-[29px] px-2.5 rounded-md max-w-[300px] min-w-0 border border-[hsl(45_45%_60%)] dark:border-[hsl(45_45%_34%)] bg-card cursor-pointer shadow-sm'
      >
        <span className='shrink-0 flex text-[hsl(45_60%_40%)] dark:text-[hsl(45_65%_62%)]'><PinGlyph /></span>
        <span className='text-xs font-bold text-foreground truncate'>{chipTitle(post)}</span>
      </button>
      {hover && canModerate && (
        <button
          type='button'
          onClick={(e) => { e.stopPropagation(); onUnpin() }}
          className='absolute -top-2 -right-2 z-[6] inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full bg-card border border-foreground/30 text-foreground/80 text-[10px] font-bold cursor-pointer shadow-lg'
        >
          <svg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
            <line x1='4' y1='4' x2='20' y2='20' /><path d='M12 17v5' /><path d='M6 11l6-6 6 6' />
          </svg>
          {t('Unpin')}
        </button>
      )}
    </div>
  )
}

/** The chat room's pinned chips row, per the prototype's BDChatScreen. */
export default function PinnedPostChips ({ posts, groupId, canModerate, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  if (!posts?.length) return null

  return (
    <div className={cn('flex items-start gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {posts.map(post => (
        <PinnedChip
          key={post.id}
          post={post}
          canModerate={canModerate}
          onOpen={() => navigate(`post/${post.id}`)}
          onUnpin={() => dispatch(pinPost(post.id, groupId))}
          t={t}
        />
      ))}
    </div>
  )
}
