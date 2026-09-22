import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Pin, PinOff } from 'lucide-react'
import { TextHelpers } from '@hylo/shared'
import pinPost from 'store/actions/pinPost'
import { cn } from 'util/index'

/** Lucide thumbtack; thicker stroke so it reads at badge/chip size. */
export function PinGlyph ({ size = 14, className }) {
  return <Pin size={size} strokeWidth={2.5} className={className} aria-hidden='true' />
}

function chipTitle (post) {
  if (post.title) return post.title
  const text = TextHelpers.presentHTMLToText(post.details || '', { truncate: 64 })
  return text || 'Post'
}

/**
 * One pinned-post chip: pin glyph + truncated title, tinted to the post type.
 * Click opens the post. Moderators get an inline Unpin that grows the chip on
 * hover; touch devices never see it, since there is no hover to reveal it with.
 * The chrome lives on the wrapper so the two buttons read as one chip.
 */
function PinnedChip ({ post, canModerate, onOpen, onUnpin, soleChip, t }) {
  return (
    <div
      className={cn(
        'group inline-flex items-center h-[29px] px-2.5 rounded-md max-w-full sm:max-w-[300px] min-w-0 border border-[hsl(45_45%_60%)] dark:border-[hsl(45_45%_34%)] bg-card shadow-sm',
        // A lone chip ellipsizes at the strip's edge; several keep their width
        // and scroll within the strip instead of crushing each other
        !soleChip && 'shrink-0'
      )}
    >
      <button
        type='button'
        onClick={onOpen}
        title={chipTitle(post)}
        className='inline-flex items-center gap-1.5 h-full min-w-0 cursor-pointer'
      >
        <span className='shrink-0 flex text-[hsl(45_60%_40%)] dark:text-[hsl(45_65%_62%)]'><PinGlyph /></span>
        <span className='text-xs font-bold text-foreground truncate'>{chipTitle(post)}</span>
      </button>
      {canModerate && (
        <button
          type='button'
          onClick={(e) => { e.stopPropagation(); onUnpin() }}
          title={t('Unpin from View')}
          aria-label={t('Unpin from View')}
          data-testid='unpin-chip-button'
          className={cn(
            'inline-flex items-center gap-1 shrink-0 overflow-hidden whitespace-nowrap',
            'text-[10px] font-bold text-foreground/80 cursor-pointer',
            // Widens in from nothing so the chip grows rather than popping
            'max-w-0 ml-0 opacity-0 transition-[max-width,margin-left,opacity] duration-200 ease-out',
            'group-hover:max-w-[72px] group-hover:ml-1.5 group-hover:opacity-100',
            'focus-visible:max-w-[72px] focus-visible:ml-1.5 focus-visible:opacity-100',
            // No hover to reveal it with, so it is not offered at all
            '[@media(hover:none)]:hidden'
          )}
        >
          <PinOff size={10} strokeWidth={2.5} aria-hidden='true' />
          <span>{t('Unpin')}</span>
        </button>
      )}
    </div>
  )
}

/** Pinned chips row for chat and calendar (stream/grid/list use full cards instead). */
export default function PinnedPostChips ({ posts, viewId, groupId, canModerate, className }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  if (!posts?.length) return null

  return (
    // Phones have no row to share with the presence cluster, so the chips
    // stack as a right-aligned column beneath it; sm+ keeps the scrolling
    // strip to the cluster's left
    <div className={cn('flex flex-col items-end sm:flex-row sm:items-start gap-1.5 sm:overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {posts.map(post => (
        <PinnedChip
          key={post.id}
          post={post}
          canModerate={canModerate}
          soleChip={posts.length === 1}
          onOpen={() => navigate(`post/${post.id}`)}
          onUnpin={() => dispatch(pinPost(post.id, viewId, groupId, post))}
          t={t}
        />
      ))}
    </div>
  )
}
