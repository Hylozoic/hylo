import React from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'

/**
 * PostGridItem displays a post as a grid card
 * If the post has an image attachment, it shows the image as background with title overlay
 * Otherwise, it shows a text-based card with title and details
 */
export default function PostGridItem ({
  childPost,
  currentGroupId,
  post,
  expanded
}) {
  const {
    title,
    details,
    creator,
    createdTimestampShort,
    attachments
  } = post

  const firstAttachment = attachments?.[0]
  const hasImage = firstAttachment?.type === 'image' && firstAttachment?.url
  const imageUrl = hasImage ? firstAttachment.url : null

  const { t } = useTranslation()
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)
  const viewPostDetails = useViewPostDetails()

  // Image card layout - image fills card with title overlay
  if (hasImage) {
    return (
      <div
        className={cn(
          'h-[180px] w-full rounded-lg shadow-lg relative cursor-pointer',
          'hover:scale-105 hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-foreground/50',
          { 'opacity-60': (isFlagged && !post.clickthrough) || post.fulfilledAt }
        )}
        onClick={() => viewPostDetails(post)}
      >
        {/* Background image */}
        <div
          className='absolute inset-0 bg-cover bg-center'
          style={{ backgroundImage: `url(${imageUrl})` }}
        />

        {/* Gradient overlay for text readability */}
        <div
          className='absolute inset-0'
          style={{
            background: 'linear-gradient(to top, hsl(var(--darkening) / 0.9) 0%, hsl(var(--darkening) / 0.4) 40%, transparent 100%)'
          }}
        />

        {/* Child post indicator */}
        {childPost && (
          <div
            className='absolute top-2 right-2 bg-white/90 rounded p-1 z-10'
            data-tooltip-content={t('Post from child group')}
            data-tooltip-id={'childgroup-tt' + post.id}
          >
            <Icon name='Subgroup' className='w-4 h-4' />
            <Tooltip delay={250} id={'childgroup-tt' + post.id} />
          </div>
        )}

        {/* Flagged indicator */}
        {isFlagged && (
          <div className='absolute inset-0 flex items-center justify-center backdrop-blur-sm'>
            <Icon name='Flag' className='w-8 h-8 text-destructive' />
          </div>
        )}

        {/* Content overlay at bottom */}
        <div className='absolute bottom-0 left-0 right-0 p-3 z-10 pb-0'>
          <h3 className='text-white font-bold text-sm line-clamp-2 drop-shadow-md mb-0 mt-0 leading-tight'>
            {title}
            {post.fulfilledAt && <span className='mr-1 align-middle'><Icon name='Checkmark' /></span>}
          </h3>
          <div className='flex items-center justify-between text-xs'>
            <div className='flex items-center gap-1.5 text-white h-8'>
              <Avatar avatarUrl={creator.avatarUrl} tiny />
              <span className='truncate max-w-[100px] font-bold'>{creator.name}</span>
            </div>
            <span className='text-white/60'>{createdTimestampShort}</span>
          </div>
        </div>
      </div>
    )
  }

  // Text card layout - no image, show details
  return (
    <div
      className={cn(
        'h-[180px] w-full bg-card rounded-lg shadow-lg relative cursor-pointer',
        'hover:scale-105 hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-foreground/50',
        'flex flex-col',
        { 'opacity-60': (isFlagged && !post.clickthrough) || post.fulfilledAt }
      )}
      onClick={() => viewPostDetails(post)}
    >
      {/* Child post indicator */}
      {childPost && (
        <div
          className='absolute top-2 right-2 bg-primary rounded p-1 z-10'
          data-tooltip-content={t('Post from child group')}
          data-tooltip-id={'childgroup-tt' + post.id}
        >
          <Icon name='Subgroup' className='w-4 h-4' />
          <Tooltip delay={250} id={'childgroup-tt' + post.id} />
        </div>
      )}

      {/* Flagged overlay */}
      {isFlagged && (
        <div className='absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20'>
          <Icon name='Flag' className='w-8 h-8 text-destructive' />
        </div>
      )}

      {/* Content */}
      <div className='p-3 flex-1 flex flex-col min-h-0 overflow-hidden pb-0'>
        <h3 className='text-foreground font-bold text-sm line-clamp-2 mb-1 mt-0 shrink-0 leading-tight'>
          {title}
          {post.fulfilledAt && <span className='mr-1 align-middle'><Icon name='Checkmark' /></span>}
        </h3>
        <p className='text-foreground/60 text-xs flex-1 mt-0 mb-0 overflow-hidden'>
          {TextHelpers.presentHTMLToText(details, { truncate: 200 })}
        </p>
      </div>

      {/* Fade gradient over text leading to footer */}
      <div
        className='absolute bottom-8 left-0 right-0 h-8 pointer-events-none'
        style={{
          background: 'linear-gradient(to bottom, transparent, hsl(var(--card)))'
        }}
      />

      {/* Footer */}
      <div className='flex items-center justify-between w-full text-xs h-8 px-3 mt-auto bg-card relative z-10'>
        <div className='flex items-center text-foreground/70'>
          <div className='flex items-center gap-1 text-foreground/100 font-bold'>
            <Avatar avatarUrl={creator.avatarUrl} tiny />
            <span className='truncate max-w-[100px]'>{creator.name}</span>
          </div>
        </div>
        <span className='text-foreground/70'>{createdTimestampShort}</span>
      </div>
    </div>
  )
}
