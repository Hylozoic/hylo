import { cn } from 'util/index'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import Avatar from 'components/Avatar'
import EmojiRow from 'components/EmojiRow'
import EventDate from 'components/PostCard/EventDate'
import EventRSVP from 'components/PostCard/EventRSVP'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useViewPostDetails from 'hooks/useViewPostDetails'
import respondToEvent from 'store/actions/respondToEvent'
import getMe from 'store/selectors/getMe'
import { personUrl } from '@hylo/navigation'

import classes from './PostBigGridItem.module.scss'

export default function PostBigGridItem ({
  childPost,
  currentGroupId,
  post,
  expanded
}) {
  const { t } = useTranslation()
  const routeParams = useParams()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const viewPostDetails = useViewPostDetails()
  const [detailsMaxHeight, setDetailsMaxHeight] = useState('200px')
  const contentSummaryRef = useRef(null)
  const detailsRef = useRef(null)
  const handleRespondToEvent = useCallback((response) => {
    dispatch(respondToEvent(post, response))
  }, [post])

  const {
    title,
    details,
    creator,
    createdTimestamp,
    attachments
  } = post
  const numAttachments = attachments.length || 0
  const firstAttachment = attachments[0] || 0
  // XXX: we should figure out what to actually do with 'video' type attachments, which are almost never used
  const attachmentType = (firstAttachment.type === 'video' ? 'file' : firstAttachment.type) || 0
  const attachmentUrl = firstAttachment.url || 0
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)

  const detailLength = details.length
  let detailClass = null

  detailLength < 75
    ? detailClass = 'detail-extra-short'
    : detailLength < 120
      ? detailClass = 'detail-short'
      : detailLength < 250
        ? detailClass = 'detail-mid'
        : detailLength < 400
          ? detailClass = 'detail-full'
          : detailClass = null

  const creatorUrl = personUrl(creator.id, routeParams.slug)
  const unread = false

  const d = post.donationsLink ? post.donationsLink.match(/(cash|clover|gofundme|opencollective|paypal|squareup|venmo)/) : null
  const donationService = d ? d[1] : null

  useEffect(() => {
    if (contentSummaryRef.current && detailsRef.current) {
      // Get the position of the details element
      const detailsRect = detailsRef.current.getBoundingClientRect()
      const containerRect = contentSummaryRef.current.getBoundingClientRect()

      // Calculate available space (container height - distance from top of container to details - bottom padding)
      const topOffset = detailsRect.top - containerRect.top
      const bottomPadding = 60 // Space for emoji row and other bottom elements
      const availableHeight = 400 - topOffset - bottomPadding

      // Set max height with a minimum value to prevent negative values
      setDetailsMaxHeight(`${Math.max(50, availableHeight)}px`)
    }
  }, [post, expanded, attachmentType])

  const showDetailsTargeted = () => {
    return attachmentType === 'image' || post.type === 'event' ? viewPostDetails(post.id) : null
  }

  if (!post.creator) return null

  return (
    <div className={cn('w-full h-[400px] bg-card/50 hover:bg-card/100 transition-all rounded-lg shadow-lg relative p-2', { [classes.unread]: unread, [classes.expanded]: expanded }, classes[attachmentType], classes[detailClass], classes[post.type])} onClick={attachmentType !== 'image' && post.type !== 'event' ? () => viewPostDetails(post.id) : null}>
      <div className={classes.contentSummary} ref={contentSummaryRef}>
        {childPost && (
          <div
            className={classes.iconContainer}
            data-tooltip-content={t('Post from child group')}
            data-tooltip-id={'childgroup-tt' + post.id}
          >
            <Icon
              name='Subgroup'
              className={classes.icon}
            />
            <Tooltip
              delay={250}
              id={'childgroup-tt' + post.id}
            />
          </div>
        )}
        <div className='flex items-center gap-2'>
          {post.type === 'event' && (
            <div className='h-full' onClick={showDetailsTargeted}>
              <EventDate {...post} />
            </div>
          )}
          <h3 className='font-bold text-foreground mb-0 mt-0 w-full' onClick={showDetailsTargeted}>
            {title}
            <div className='w-full flex items-center justify-between' onClick={() => viewPostDetails(post)}>
              <div className='text-foreground/60 text-xs font-normal flex items-center gap-1'>
                <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={classes.avatar} tiny />
                {creator.name}
              </div>
              <div className='text-foreground/60 text-xs font-normal'>
                {createdTimestamp}
              </div>
            </div>
          </h3>
        </div>

        {attachmentType === 'image'
          ? <div style={{ backgroundImage: `url(${attachmentUrl})` }} className={cn(classes.firstImage, { [classes.isFlagged]: isFlagged && !post.clickthrough })} onClick={() => viewPostDetails(post)} />
          : null}

        {isFlagged && <Icon name='Flag' className={classes.flagIcon} />}

        <div className={cn({ [classes.isFlagged]: isFlagged && !post.clickthrough })} ref={detailsRef}>
          <HyloHTML html={details} onClick={showDetailsTargeted} className='text-foreground/60 text-sm overflow-hidden' style={{ maxHeight: detailsMaxHeight }} />
        </div>

        <div className='absolute bottom-0 rounded-b-lg left-0 right-0 p-2 bg-gradient-to-t from-card/100 to-card/80 pb-1'>
          <div className={classes.gridMetaRow1}>
            <h3 className={classes.title} onClick={() => viewPostDetails(post)}>{title}</h3>
            <div className={classes.contentSnippet}>
              <HyloHTML html={details} onClick={showDetailsTargeted} className='line-clamp-6' />
            </div>
            <div className={classes.projectActions}>
              {post.donationsLink && donationService && (
                <div className={classes.donate}>
                  <div><img src={`/assets/payment-services/${donationService}.svg`} alt={donationService} /></div>
                  <div><a className={classes.projectButton} rel='noreferrer' href={post.donationsLink} target='_blank'>{t('Contribute')}</a></div>
                </div>
              )}
              {post.donationsLink && !donationService && (
                <div className={classes.donate}>
                  <div>{t('Support this project')}</div>
                  <div><a className={classes.projectButton} rel='noreferrer' href={post.donationsLink} target='_blank'>{t('Contribute')}</a></div>
                </div>
              )}
              {attachmentType === 'file' && (
                <div className={classes.fileAttachment}>
                  {numAttachments > 1
                    ? <div className={classes.attachmentNumber}>{numAttachments} {t('attachments')}</div>
                    : null}
                  <div className={classes.attachment}>
                    <Icon name='Document' className={classes.fileIcon} />
                    <div className={classes.attachmentName}>{attachmentUrl.substring(firstAttachment.url.lastIndexOf('/') + 1)}</div>
                  </div>
                </div>
              )}
              {post.type === 'event' && (
                <div className='border-2 mt-2 items-center mb-2 justify-between flex border-t-foreground/30 border-x-foreground/20 border-b-foreground/10 p-4 bg-midground/50 rounded-lg border-dashed relative text-center z-10'>
                  <div className='text-foreground/100 text-sm'>{t('Can you go?')}</div>
                  <EventRSVP {...post} respondToEvent={handleRespondToEvent} position='top' />
                </div>
              )}
            </div>
          </div>
          <div>
            <EmojiRow
              currentUser={currentUser}
              post={post}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
