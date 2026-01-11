import { cn } from 'util/index'
import React, { useEffect, useState } from 'react'
import { pick } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import ReactPlayer from 'react-player'
import Highlight from 'components/Highlight'
import HyloHTML from 'components/HyloHTML'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import Feature from 'components/PostCard/Feature'
import LinkPreview from 'components/LinkPreview'
import Tooltip from 'components/Tooltip'

import classes from './PostContent.module.scss'

const MAX_DETAILS_LENGTH = 144

export default function PostContent ({
  details: providedDetails,
  linkPreview,
  linkPreviewFeatured,
  slug,
  constrained,
  expanded,
  highlightProps,
  fileAttachments,
  onClick,
  editedTimestamp,
  exactEditedTimestamp,
  ...post
}) {
  const [isVideo, setIsVideo] = useState()
  const { t } = useTranslation()

  useEffect(() => {
    if (linkPreview?.url) {
      setIsVideo(ReactPlayer.canPlay(linkPreview?.url))
    }
  }, [linkPreview?.url])

  const details = expanded ? providedDetails : TextHelpers.truncateHTML(providedDetails, MAX_DETAILS_LENGTH)

  return (
    <Highlight {...highlightProps}>
      <div onClick={onClick} className={cn('p-0 global-postContent', { [classes.constrained]: constrained })}>
        <div className={classes.fade} />
        {linkPreview?.url && linkPreviewFeatured && isVideo && (
          <Feature url={linkPreview.url} />
        )}
        {details && (
          <ClickCatcher groupSlug={slug}>
            <HyloHTML className='[&>*:last-child]:mb-0' html={details} />
          </ClickCatcher>
        )}
        {editedTimestamp && (
          <div className={classes.timestamp} data-tooltip-id={`editedTip-${expanded ? 'expanded' : 'collapsed'}-${post.id}`} data-tooltip-content={exactEditedTimestamp}>
            {editedTimestamp}
          </div>
        )}
        {(post.type === 'project' || post.type === 'submission') && !constrained && expanded && post.budget && (
          <div className='mt-3 mb-2 text-sm text-foreground/80'>
            <span className='font-semibold'>{t('Budget')}: </span>
            {post.budget}
          </div>
        )}
        <div className='flex flex-col gap-4'>
          {linkPreview && !linkPreviewFeatured && (
            <LinkPreview {...pick(['title', 'description', 'url', 'imageUrl'], linkPreview)} />
          )}
          {fileAttachments && fileAttachments.length > 0 && (
            <CardFileAttachments attachments={fileAttachments} />
          )}
        </div>
        <Tooltip
          delay={550}
          id={`editedTip-${expanded ? 'expanded' : 'collapsed'}-${post.id}`}
          position='right'
        />
      </div>
    </Highlight>
  )
}
