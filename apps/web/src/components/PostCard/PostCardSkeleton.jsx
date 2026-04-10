import React from 'react'
import Skeleton from 'components/Skeleton'
import { STREAM_MAIN_COLUMN_CLASS, CHAT_MESSAGE_COLUMN_CLASS } from 'util/mainContentColumn'
import { cn } from 'util/index'

/** Single post-card shaped skeleton. Matches the avatar / type-badge / title / body / footer layout of PostCard. */
function PostCardSkeleton () {
  return (
    <div className='rounded-xl border-2 border-foreground/5 bg-card/50 p-3 mb-4' aria-busy='true' aria-label='Loading post'>
      {/* Header: avatar + creator name + timestamp + type badge */}
      <div className='flex items-center gap-2.5 mb-3'>
        <Skeleton className='w-[38px] h-[38px] rounded-full flex-shrink-0' />
        <div className='flex-1 flex flex-col gap-1.5'>
          <Skeleton className='h-[10px] w-[38%]' />
          <Skeleton className='h-[8px] w-[22%]' />
        </div>
        <Skeleton className='h-[20px] w-[52px] rounded-full flex-shrink-0' />
      </div>
      {/* Title + body lines */}
      <div className='flex flex-col gap-[7px] mb-3'>
        <Skeleton className='h-[14px] w-[70%]' />
        <Skeleton className='h-[10px] w-full' />
        <Skeleton className='h-[10px] w-[86%]' />
        <Skeleton className='h-[10px] w-[55%]' />
      </div>
      {/* Footer: comment count + reactions */}
      <div className='flex items-center gap-2 pt-2.5 border-t border-foreground/5'>
        <Skeleton className='h-[24px] w-[56px] rounded-full' />
        <Skeleton className='h-[24px] w-[44px] rounded-full' />
        <div className='flex-1' />
        <Skeleton className='h-[24px] w-[36px] rounded-full' />
      </div>
    </div>
  )
}

/**
 * Staggered post-card skeletons for stream/feed (and similar) loading.
 * @param {object} props
 * @param {boolean} [props.wrapWithMainColumn=true] — When true, applies max width + padding for stream or chat. Set false when already inside Stream’s `stream-inner-container`.
 * @param {'stream'|'chat'} [props.columnVariant='stream'] — `chat` uses the same column as ChatRoom’s message list.
 * @param {number} [props.placeholderCount=4] — How many card placeholders to render (use fewer for “below cached posts” refresh).
 */
export function StreamSkeleton ({ wrapWithMainColumn = true, columnVariant = 'stream', placeholderCount = 4 }) {
  const columnClass =
    columnVariant === 'chat' ? CHAT_MESSAGE_COLUMN_CLASS : STREAM_MAIN_COLUMN_CLASS

  const indices = Array.from({ length: placeholderCount }, (_, i) => i)

  const list = (
    <>
      {indices.map(i => (
        <div
          key={i}
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
          className='animate-slide-up'
        >
          <PostCardSkeleton />
        </div>
      ))}
    </>
  )

  if (!wrapWithMainColumn) {
    return <div className='w-full'>{list}</div>
  }

  return (
    <div className={cn(columnClass)}>
      {list}
    </div>
  )
}

export default PostCardSkeleton
