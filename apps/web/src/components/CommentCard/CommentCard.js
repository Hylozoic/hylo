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
  const postTitle = post.title
    ? TextHelpers.truncateText(post.title, 25)
    : post.details
      ? TextHelpers.truncateHTML(post.details, 25)
      : 'a post' // Fallback when both title and details are empty

  const commentText = expanded ? comment.text : TextHelpers.truncateHTML(comment.text, 144)

  const { t } = useTranslation()

  return (
    <span onClick={() => showDetails(comment.post.id)} className={classes.link} data-testid='comment-card'>
      <div className={cn(
        'rounded-xl cursor-pointer relative flex flex-col transition-all bg-card/40 border-2 border-card/30 shadow-md hover:shadow-lg mb-4 hover:z-50 hover:scale-105 duration-400',
        classes.commentCard,
        { [classes.expanded]: expanded })}
      >
        <div className={classes.commentHeader}>
          <div className='flex flex-row items-center justify-between w-full gap-2'>
            <div className='flex flex-row items-center'>
              <RoundImage url={creator.avatarUrl} medium />
              <Highlight {...highlightProps}>
                <div className='font-bold ml-2'>
                  <span className='font-bold font-md text-base'>{creator.name}</span> {t('commented on')}{' '}
                  <span className='text-base'>{postTitle}</span>
                </div>
              </Highlight>
            </div>
            <span className='text-foreground/50 text-2xs whitespace-nowrap'>{timestamp}</span>
          </div>
        </div>
        {attachments && attachments.length > 0 && (
          <>
            <CardImageAttachments attachments={attachments} linked className={classes.commentImages} />
            <CardFileAttachments attachments={attachments} className={classes.commentFiles} />
          </>
        )}
        <ClickCatcher groupSlug={slug}>
          <Highlight {...highlightProps}>
            <HyloHTML html={commentText} />
          </Highlight>
        </ClickCatcher>
        <div className={classes.commentFooter} />
      </div>
    </span>
  )
}
