import { cn } from 'util/index'
import React from 'react'
import { pick } from 'lodash/fp'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import Highlight from 'components/Highlight'
import HyloHTML from 'components/HyloHTML'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import Feature from 'components/PostCard/Feature'
import LinkPreview from 'components/LinkPreview'
import Tooltip from 'components/Tooltip'
import isPlayableVideoUrl from 'util/isPlayableVideoUrl'

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
  const { t } = useTranslation()
  const previewUrl = linkPreview?.url || linkPreview?.ref?.url
  const showFeaturedVideo = linkPreviewFeatured && isPlayableVideoUrl(previewUrl)

  const details = expanded ? providedDetails : TextHelpers.truncateHTML(providedDetails, MAX_DETAILS_LENGTH)

  return (
    <Highlight {...highlightProps}>
      <div onClick={onClick} className={cn('p-0 global-postContent', { [classes.constrained]: constrained })}>
        <div className={classes.fade} />
        {showFeaturedVideo && (
          <Feature url={previewUrl} />
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
          {linkPreview && !showFeaturedVideo && (
            <LinkPreview {...pick(['title', 'description', 'url', 'imageUrl'], linkPreview.ref || linkPreview)} />
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
