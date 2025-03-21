import { isEmpty } from 'lodash/fp'
import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Avatar from 'components/Avatar'
import EmojiRow from 'components/EmojiRow'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useRouteParams from 'hooks/useRouteParams'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { cn } from 'util/index'
import { personUrl, topicUrl } from 'util/navigation'
import { DateTimeHelpers } from '@hylo/shared'

import classes from './PostListRow.module.scss'

// :SHONK: no idea why React propagates events from child elements but NOT IN OTHER COMPONENTS
const stopEvent = (e) => e.stopPropagation()

const PostListRow = (props) => {
  const {
    childPost,
    currentGroupId,
    post,
    expanded,
    currentUser
  } = props

  const {
    title,
    details,
    creator,
    createdTimestamp,
    commentersTotal,
    topics
  } = post

  const { t } = useTranslation()
  const routeParams = useRouteParams()

  const viewPostDetails = useViewPostDetails()

  if (!creator) { // PostCard guards against this, so it must be important? ;P
    return null
  }

  const typeLowercase = post.type.toLowerCase()
  const typeName = post.type.charAt(0).toUpperCase() + typeLowercase.slice(1)

  const creatorUrl = personUrl(creator.id, routeParams.slug)
  const numOtherCommentors = commentersTotal - 1
  const unread = false
  const start = DateTimeHelpers.toDateTime(post.startTime)
  const end = DateTimeHelpers.toDateTime(post.endTime)
  const isSameDay = DateTimeHelpers.sameDay(start, end)
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)

  return (
    <div className={cn('bg-card/50 hover:bg-card/100 transition-all p-3 border-b-2 border-midground text-foreground', classes.postRow, { [classes.unread]: unread, [classes.expanded]: expanded })} onClick={() => viewPostDetails(post)}>
      <div className={classes.contentSummary}>
        <div className={classes.typeAuthor}>
          {isFlagged && <Icon name='Flag' className={classes.flagIcon} />}
          <div className={cn(classes.postType, classes[post.type])}>
            <Icon name={typeName} />
          </div>
          <div className={classes.participants}>
            {post.type === 'event'
              ? (
                <div className={classes.date}>
                  <span>{isSameDay ? start.toFormat('MMM d') : `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}`}</span>
                </div>
                )
              : (
                <div>
                  <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={classes.avatar} small />
                  {creator.name}
                  {numOtherCommentors > 1
                    ? (<span> {t('and')} <strong>{numOtherCommentors} {t('others')}</strong></span>)
                    : null}
                </div>
                )}
          </div>
          {childPost && (
            <div
              className={classes.iconContainer}
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
                position='bottom'
              />
            </div>
          )}
          <div className={cn(classes.timestamp, { [classes.pushToRight]: !childPost })}>
            {createdTimestamp}
          </div>
        </div>
        {!isEmpty(topics) && (
          <div className={classes.topics}>
            {topics.slice(0, 3).map(t =>
              <Link className={classes.topic} to={topicUrl(t.name, { groupSlug: routeParams.slug })} key={t.name} onClick={stopEvent}>#{t.name}</Link>)}
          </div>
        )}
        <div className={cn({ [classes.isFlagged]: isFlagged && !post.clickthrough })}>
          <h3 className={cn('font-bold text-foreground mb-0')}>{title}</h3>
          <HyloHTML className='text-foreground/60 text-sm line-clamp-1 -mt-[10px]' html={details} />
        </div>
        <div className={classes.reactions}>
          <EmojiRow
            post={post}
            currentUser={currentUser}
          />
        </div>
      </div>
      <Tooltip
        delay={550}
        id={`post-tt-${post.id}`}
      />
    </div>
  )
}

export default PostListRow
