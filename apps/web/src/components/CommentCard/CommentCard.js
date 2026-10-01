import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import RoundImage from 'components/RoundImage'
import Highlight from 'components/Highlight'
import HyloHTML from 'components/HyloHTML'
import ClickCatcher from 'components/ClickCatcher'
import CardImageAttachments from 'components/CardImageAttachments'
import CardFileAttachments from 'components/CardFileAttachments'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'
import classes from './CommentCard.module.scss'

export default function CommentCard ({
  comment,
  expanded = true,
  highlightProps
}) {
  const { t } = useTranslation()
  const viewPostDetails = useViewPostDetails()

  const { creator, post, slug, createdAt, editedAt, attachments } = comment
  const timestamp = useMemo(() => (editedAt ? 'Edited ' : 'Commented ') + TextHelpers.humanDate(editedAt || createdAt), [editedAt, createdAt])
  const postTitle = useMemo(() => {
    if (post.title) return TextHelpers.truncateText(post.title, 25)
    const detailsText = TextHelpers.presentHTMLToText(post.details, { truncate: 25 }).replace(/\n/g, ' ').trim()
    return detailsText || 'a post'
  }, [post.title, post.details])

  const commentText = useMemo(() => expanded ? comment.text : TextHelpers.truncateHTML(comment.text, 144), [expanded, comment.text])

  return (
    <span onClick={() => viewPostDetails(comment.post)} className={cn(classes.link, 'block max-w-full min-w-0')} data-testid='comment-card'>
      <div className={cn(
        'rounded-xl cursor-pointer relative flex flex-col transition-all bg-card/40 border-2 border-card/30 shadow-md hover:shadow-lg mb-4 hover:z-50 hover:scale-105 duration-400 w-full min-w-0 max-w-full',
        classes.commentCard,
        { [classes.expanded]: expanded })}
      >
        <div className={cn(classes.commentHeader, 'w-full min-w-0')}>
          <div className='flex flex-row flex-wrap items-center justify-between w-full min-w-0 gap-x-2 gap-y-0.5'>
            <div className='flex flex-row items-center min-w-0 max-w-full overflow-hidden'>
              <RoundImage url={creator.avatarUrl} medium />
              <Highlight {...highlightProps}>
                <div className='ml-2 flex min-w-0 gap-1 overflow-hidden'>
                  <span className='hidden sm:block text-sm sm:text-base font-bold whitespace-nowrap shrink-0'>{creator.name}</span>
                  <span className='text-sm sm:text-base opacity-50 sm:opacity-100 whitespace-nowrap shrink-0'>{t('commented on')}{' '}</span>
                  <span className='text-sm sm:text-base truncate font-bold min-w-0'>{postTitle}</span>
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
