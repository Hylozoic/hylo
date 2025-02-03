import React, { useCallback } from 'react'
import { cn } from 'util/index'
import Tooltip from 'components/Tooltip'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { personUrl, postUrl } from 'util/navigation'
import Avatar from 'components/Avatar'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import classes from './PostGridItem.module.scss'

export default function PostGridItem ({
  childPost,
  currentGroupId,
  routeParams,
  post,
  expanded,
  locationParams,
  querystringParams
}) {
  const {
    title,
    details,
    creator,
    createdTimestampForGrid,
    attachments
  } = post

  const navigate = useNavigate()

  const numAttachments = attachments.length || 0
  const firstAttachment = attachments[0] || 0
  const attachmentType = firstAttachment.type || 0
  const attachmentUrl = firstAttachment.url || 0
  const { t } = useTranslation()
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)
  const creatorUrl = personUrl(creator.id, routeParams.slug)
  const unread = false
  // will reintegrate once I have attachment vars
  /* const start = DateTime.fromISO(post.startTime) */

  const showDetails = useCallback(() => {
    navigate(postUrl(post.id, routeParams, { ...locationParams, ...querystringParams }))
  }, [post.id, routeParams, locationParams, querystringParams])

  return (
    <div className={cn('h-[160px] w-full bg-background rounded-lg shadow-lg relative hover:scale-105 transition-all overflow-hidden', { [classes.unread]: unread, [classes.expanded]: expanded }, classes[attachmentType])} onClick={showDetails}>
      <div className={classes.contentSummary}>
        {childPost &&
          <div
            className='bg-primary rounded w-[20px] h-[20px] flex items-center absolute top-1 right-1'
            data-tooltip-content={t('Post from child group')}
            data-tooltip-id='childgroup-tt'
          >
            <Icon
              name='Subgroup'
              className={classes.icon}
            />
            <Tooltip
              delay={250}
              id='childgroup-tt'
            />
          </div>}
        <h3 className={cn('text-base text-foreground m-0 px-2', { [classes.isFlagged]: isFlagged && !post.clickthrough })}>{title}</h3>
        {attachmentType === 'image'
          ? <div style={{ backgroundImage: `url(${attachmentUrl})` }} className={cn(classes.firstImage, { [classes.isFlagged]: isFlagged && !post.clickthrough })} />
          : attachmentType === 'file'
            ? (
              <div className={classes.fileAttachment}>
                {numAttachments > 1
                  ? <div className={classes.attachmentNumber}>{numAttachments} attachments</div>
                  : ' '}
                <Icon name='Document' className={classes.fileIcon} />
                <div className={classes.attachmentName}>{attachmentUrl.substring(firstAttachment.url.lastIndexOf('/') + 1)}</div>
              </div>
              )
            : ' '}
        {isFlagged && <Icon name='Flag' className={classes.flagIcon} />}

        <div className={cn('text-foreground text-xs px-2 opacity-75', { [classes.isFlagged]: isFlagged && !post.clickthrough })}>
          <HyloHTML html={details} />
        </div>
        <div className={classes.gridMeta}>
          <div className={classes.gridMetaRow1}>
            <div className={classes.typeAuthor}>
              <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={classes.avatar} tiny />
              {creator.name}
            </div>
            <span className={classes.timestamp}>
              {createdTimestampForGrid}
            </span>
          </div>
        </div>
        <div className='absolute bottom-0 left-0 right-0 h-full bg-gradient-to-t from-background to-transparent' />
      </div>
    </div>
  )
}
