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
 * Click opens the post. Moderators always see Unpin (hover is not available on touch).
 */
function PinnedChip ({ post, canModerate, onOpen, onUnpin, t }) {
  return (
    <div className='relative inline-flex shrink-0 items-center'>
      <button
        type='button'
        onClick={onOpen}
        title={chipTitle(post)}
        className='inline-flex items-center gap-1.5 h-[29px] px-2.5 rounded-md max-w-[300px] min-w-0 border border-[hsl(45_45%_60%)] dark:border-[hsl(45_45%_34%)] bg-card cursor-pointer shadow-sm'
      >
        <span className='shrink-0 flex text-[hsl(45_60%_40%)] dark:text-[hsl(45_65%_62%)]'><PinGlyph /></span>
        <span className='text-xs font-bold text-foreground truncate'>{chipTitle(post)}</span>
      </button>
      {canModerate && (
        <button
          type='button'
          onClick={(e) => { e.stopPropagation(); onUnpin() }}
          title={t('Unpin from View')}
          className='absolute -top-2 -right-2 z-[6] inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-card border border-foreground/30 text-foreground/80 text-[10px] font-bold cursor-pointer shadow-lg'
        >
          <PinOff size={10} strokeWidth={2.5} aria-hidden='true' />
          <span className='hidden sm:inline'>{t('Unpin')}</span>
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
    <div className={cn('flex items-start gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {posts.map(post => (
        <PinnedChip
          key={post.id}
          post={post}
          canModerate={canModerate}
          onOpen={() => navigate(`post/${post.id}`)}
          onUnpin={() => dispatch(pinPost(post.id, viewId, groupId, post))}
          t={t}
        />
      ))}
    </div>
  )
}
