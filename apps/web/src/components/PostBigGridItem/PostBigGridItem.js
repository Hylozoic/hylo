import { cn } from 'util/index'
import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { CircleCheckBig } from 'lucide-react'
import { TextHelpers } from '@hylo/shared'
import Avatar from 'components/Avatar'
import EmojiRow from 'components/EmojiRow'
import EventDate from 'components/PostCard/EventDate'
import EventRSVP from 'components/PostCard/EventRSVP'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useViewPostDetails from 'hooks/useViewPostDetails'
import respondToEvent from 'store/actions/respondToEvent'
import getMe from 'store/selectors/getMe'

/**
 * PostBigGridItem displays a post as a large grid card (400px height)
 * If the post has an image attachment, it shows the image as background with content overlay
 * Otherwise, it shows a text-based card with title and details
 * Supports events with RSVP, donations, file attachments, and emoji reactions
 */
export default function PostBigGridItem ({
  childPost,
  currentGroupId,
  post,
  currentUser: propCurrentUser
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe) || propCurrentUser
  const viewPostDetails = useViewPostDetails()

  const handleRespondToEvent = useCallback((response) => {
    dispatch(respondToEvent(post, response))
  }, [post, dispatch])

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
  const hasFile = firstAttachment?.type === 'file'
  const numAttachments = attachments?.length || 0

  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)
  const isEvent = post.type === 'event'

  // Donation link detection
  const donationMatch = post.donationsLink?.match(/(cash|clover|gofundme|opencollective|paypal|squareup|venmo)/)
  const donationService = donationMatch ? donationMatch[1] : null

  if (!creator) return null

  // Image card layout - image fills card with content overlay
  if (hasImage) {
    return (
      <div
        className={cn(
          'h-[400px] w-full rounded-lg shadow-lg relative cursor-pointer',
          'hover:scale-[1.02] hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-foreground/50',
          {
            'opacity-60': (isFlagged && !post.clickthrough) || post.fulfilledAt
          }
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
            background: 'linear-gradient(to top, hsl(var(--darkening) / 0.95) 0%, hsl(var(--darkening) / 0.6) 50%, hsl(var(--darkening) / 0.2) 100%)'
          }}
        />

        {/* Child post indicator */}
        {childPost && (
          <div
            className='absolute top-3 right-3 bg-white/90 rounded p-1.5 z-10'
            data-tooltip-content={t('Post from child group')}
            data-tooltip-id={'childgroup-tt' + post.id}
          >
            <Icon name='Subgroup' className='w-4 h-4' />
            <Tooltip delay={250} id={'childgroup-tt' + post.id} />
          </div>
        )}

        {/* Flagged indicator */}
        {isFlagged && (
          <div className='absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20'>
            <Icon name='Flag' className='w-12 h-12 text-destructive' />
          </div>
        )}

        {/* Content overlay at bottom */}
        <div className='absolute bottom-0 left-0 right-0 p-3 z-10'>
          {/* Event date badge */}
          {isEvent && (
            <div className='mb-2'>
              <EventDate {...post} />
            </div>
          )}

          <div className='flex items-center gap-2 text-white'>
            <div className='flex items-center gap-1 text-white font-bold h-6 text-xs'>
              <Avatar avatarUrl={creator.avatarUrl} tiny />
              <span className='truncate font-bold'>{creator.name}</span>
            </div>
            <span className='text-white/50 text-xs'>{createdTimestampShort}</span>
          </div>
          <h3 className='text-white font-bold text-lg line-clamp-2 drop-shadow-md mb-1 mt-0 leading-tight'>
            <span className={cn('flex items-center', { 'opacity-60': (isFlagged && !post.clickthrough) || post.fulfilledAt })}>
              {post.fulfilledAt && <span className='mr-1'><CircleCheckBig className='w-5 text-green-500' /></span>}
              {title}
            </span>
          </h3>

          {/* Event RSVP */}
          {isEvent && (
            <div className='flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-lg p-3 mb-3'>
              <span className='text-white text-sm'>{t('Can you go?')}</span>
              <EventRSVP {...post} respondToEvent={handleRespondToEvent} position='top' />
            </div>
          )}

          {/* Donation link */}
          {post.donationsLink && (
            <a
              href={post.donationsLink}
              target='_blank'
              rel='noreferrer'
              onClick={(e) => e.stopPropagation()}
              className='flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2 mb-3 hover:bg-white/20 transition-colors'
            >
              {donationService && (
                <img src={`/assets/payment-services/${donationService}.svg`} alt={donationService} className='h-5' />
              )}
              <span className='text-white text-sm'>{t('Contribute')}</span>
            </a>
          )}

          {/* Footer: Author + timestamp + emoji */}
          <div className='flex items-center justify-between text-white'>
            <EmojiRow currentUser={currentUser} post={post} />
          </div>
        </div>
      </div>
    )
  }

  // Text card layout - no image, show full details
  return (
    <div
      className={cn(
        'h-[400px] w-full bg-card rounded-lg shadow-lg relative cursor-pointer',
        'hover:scale-[1.02] hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-foreground/50',
        'flex flex-col',
        { 'opacity-60': (isFlagged && !post.clickthrough) || post.fulfilledAt }
      )}
      onClick={() => viewPostDetails(post)}
    >
      {/* Child post indicator */}
      {childPost && (
        <div
          className='absolute top-3 right-3 bg-primary rounded p-1.5 z-10'
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
          <Icon name='Flag' className='w-12 h-12 text-destructive' />
        </div>
      )}

      {/* Content */}
      <div className='p-3 flex-1 flex flex-col min-h-0 overflow-hidden'>
        {/* Header: Event date + title */}
        <div className='flex items-start gap-3 mb-2 shrink-0'>
          {isEvent && <EventDate {...post} />}
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 text-xs text-foreground/60'>
              <Avatar avatarUrl={creator.avatarUrl} tiny />
              <span className='font-bold text-foreground truncate max-w-[100px]'>{creator.name}</span>
              <span>{createdTimestampShort}</span>
            </div>
            <h3 className='flex items-center text-foreground font-bold text-lg line-clamp-2 mb-1 mt-0 leading-tight'>
              {post.fulfilledAt && <span className='mr-1'><CircleCheckBig className='w-5 text-green-500' /></span>}
              {title}
            </h3>
          </div>
        </div>

        {/* Details text */}
        <p className='text-foreground/60 text-sm flex-1 overflow-hidden mb-2'>
          {TextHelpers.presentHTMLToText(details, { truncate: 400 })}
        </p>

        {/* File attachment indicator */}
        {hasFile && (
          <div className='flex items-center gap-2 text-accent bg-accent/10 rounded-lg p-2 mb-2 shrink-0'>
            <Icon name='Document' className='w-5 h-5' />
            <span className='text-sm'>
              {numAttachments > 1 ? `${numAttachments} ${t('attachments')}` : t('1 attachment')}
            </span>
          </div>
        )}

        {/* Event RSVP */}
        {isEvent && (
          <div className='flex items-center justify-between bg-midground/50 border-2 border-dashed border-foreground/20 rounded-lg p-3 mb-2 shrink-0'>
            <span className='text-foreground text-sm'>{t('Can you go?')}</span>
            <EventRSVP {...post} respondToEvent={handleRespondToEvent} position='top' />
          </div>
        )}

        {/* Donation link */}
        {post.donationsLink && (
          <a
            href={post.donationsLink}
            target='_blank'
            rel='noreferrer'
            onClick={(e) => e.stopPropagation()}
            className='flex items-center gap-2 bg-accent/10 rounded-lg p-2 mb-2 hover:bg-accent/20 transition-colors shrink-0'
          >
            {donationService && (
              <img src={`/assets/payment-services/${donationService}.svg`} alt={donationService} className='h-5' />
            )}
            <span className='text-accent text-sm font-medium'>{t('Contribute')}</span>
          </a>
        )}
      </div>

      {/* Fade gradient over text leading to footer */}
      <div
        className='absolute bottom-12 left-0 right-0 h-8 pointer-events-none'
        style={{
          background: 'linear-gradient(to bottom, transparent, hsl(var(--card)))'
        }}
      />

      {/* Footer */}
      <div className='px-4 py-2 mt-auto bg-card relative z-10 border-t border-foreground/10'>
        <EmojiRow currentUser={currentUser} post={post} />
      </div>
    </div>
  )
}
