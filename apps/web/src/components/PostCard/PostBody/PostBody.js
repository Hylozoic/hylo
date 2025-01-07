import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import PostTitle from '../PostTitle'
import PostContent from '../PostContent'
import PostBodyProposal from '../PostBodyProposal'
import EmojiRow from 'components/EmojiRow'
import { recordClickthrough } from 'store/actions/moderationActions'

import classes from './PostBody.module.scss'

export default function PostBody (props) {
  const {
    slug,
    expanded,
    className,
    constrained,
    currentUser,
    highlightProps,
    isFlagged,
    mapDrawer = false,
    onClick,
    onAddReaction = () => {},
    onRemoveReaction = () => {},
    ...post
  } = props
  const dispatch = useDispatch()
  const { t } = useTranslation()

  return (
    <div>
      {isFlagged && !post.clickthrough &&
        <div className={classes.clickthroughContainer}>
          <div>{t('clickthroughExplainer')}</div>
          <div className={classes.clickthroughButton} onClick={() => dispatch(recordClickthrough({ postId: post.id }))}>{t('View post')}</div>
        </div>}

      <div className={cn(classes.body, { [classes.smallMargin]: !expanded, [classes.constrained]: constrained, [classes.isFlagged]: isFlagged && !post.clickthrough }, className)}>
        {post.type !== 'chat' && (
          <PostTitle
            {...post}
            highlightProps={highlightProps}
            constrained={constrained}
            onClick={onClick}
          />
        )}

        <PostContent
          {...post}
          slug={slug}
          highlightProps={highlightProps}
          expanded={expanded}
          constrained={constrained}
          onClick={onClick}
        />
      </div>
      {post.type === 'proposal' && !mapDrawer && <PostBodyProposal {...post} isFlagged={isFlagged && !post.clickthrough} currentUser={currentUser} />}
      <div className={classes.reactions}>
        <EmojiRow
          post={post}
          currentUser={currentUser}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
        />
      </div>
    </div>
  )
}
