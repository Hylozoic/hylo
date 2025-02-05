import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from 'util/index'
import RoundImage from 'components/RoundImage'
import { TextHelpers } from '@hylo/shared'
import Highlight from 'components/Highlight'
import HyloHTML from 'components/HyloHTML'
import ClickCatcher from 'components/ClickCatcher'
import CardImageAttachments from 'components/CardImageAttachments'
import CardFileAttachments from 'components/CardFileAttachments'
import classes from './CommentCard.module.scss'

export default function CommentCard ({
  comment,
  showDetails,
  expanded = true,
  highlightProps
}) {
  const { creator, post, slug, createdAt, editedAt, attachments } = comment
  const timestamp = (editedAt ? 'Edited ' : 'Commented ') + TextHelpers.humanDate(editedAt || createdAt)
  const postTitle = post.title ? TextHelpers.truncateText(post.title, 25) : TextHelpers.truncateHTML(post.details, 25)

  const commentText = expanded ? comment.text : TextHelpers.truncateHTML(comment.text, 144)

  const { t } = useTranslation()

  return (
    <span onClick={() => showDetails(comment.post.id)} className={classes.link} data-testid='comment-card'>
      <div className={cn(classes.commentCard, { [classes.expanded]: expanded })}>
        <div className={classes.commentHeader}>
          <RoundImage url={creator.avatarUrl} className={classes.profileImage} />
          <Highlight {...highlightProps}>
            <div className={classes.commentMeta}>
              <span className={classes.personName}>{creator.name}</span> {t('commented on')}{' '}
              <span className={classes.postTitle}>{postTitle}</span>
            </div>
          </Highlight>
          <span className={classes.date}>{timestamp}</span>
        </div>
        <CardImageAttachments attachments={attachments} linked className={classes.commentImages} />
        <CardFileAttachments attachments={attachments} className={classes.commentFiles} />
        <ClickCatcher groupSlug={slug}>
          <Highlight {...highlightProps}>
            <HyloHTML className={classes.commentBody} html={commentText} />
          </Highlight>
        </ClickCatcher>
        <div className={classes.commentFooter} />
      </div>
    </span>
  )
}
