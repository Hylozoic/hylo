import { cn } from 'util/index'
import React from 'react'
import { FlagCover } from 'components/FlagBadge'
import PostTitle from '../PostTitle'
import PostContent from '../PostContent'
import PostBodyProposal from '../PostBodyProposal'

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
    flagCover = true,
    onRevealFlagged,
    mapDrawer = false,
    onClick,
    onAddProposalVote,
    onRemoveProposalVote,
    onSwapProposalVote,
    ...post
  } = props

  return (
    <div className='relative'>
      {isFlagged && flagCover &&
        <FlagCover post={post} onView={onRevealFlagged} />}

      <div className={cn('p-2 pb-0', { [classes.smallMargin]: !expanded, [classes.constrained]: constrained, [classes.isFlagged]: isFlagged }, className)}>
        {post.type !== 'chat' && (
          <PostTitle
            {...post}
            highlightProps={highlightProps}
            constrained={constrained}
            onClick={onClick}
          />
        )}

        {!mapDrawer && (
          <PostContent
            {...post}
            slug={slug}
            highlightProps={highlightProps}
            expanded={expanded}
            constrained={constrained}
            onClick={onClick}
          />
        )}
      </div>
      {post.type === 'proposal' && !mapDrawer &&
        <PostBodyProposal
          post={post}
          isFlagged={isFlagged && !post.clickthrough}
          currentUser={currentUser}
          onAddProposalVote={onAddProposalVote}
          onRemoveProposalVote={onRemoveProposalVote}
          onSwapProposalVote={onSwapProposalVote}
        />}
    </div>
  )
}
