import { isEmpty } from 'lodash/fp'
import { DateTime } from 'luxon'
import qs from 'query-string'
import React, { useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Avatar from 'components/Avatar'
import EmojiRow from 'components/EmojiRow'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useRouteParams from 'hooks/useRouteParams'
import { cn } from 'util/index'
import { personUrl, postUrl, topicUrl } from 'util/navigation'

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
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const querystringParams = qs.parse(location.search)

  const showDetails = useCallback(() => {
    navigate(postUrl(post.id, routeParams, querystringParams))
  }, [post.id, routeParams, querystringParams])

  if (!creator) { // PostCard guards against this, so it must be important? ;P
    return null
  }

  const typeLowercase = post.type.toLowerCase()
  const typeName = post.type.charAt(0).toUpperCase() + typeLowercase.slice(1)

  const creatorUrl = personUrl(creator.id, routeParams.slug)
  const numOtherCommentors = commentersTotal - 1
  const unread = false
  const start = DateTime.fromJSDate(post.startTime)
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)

  return (
    <div className={cn(classes.postRow, { [classes.unread]: unread, [classes.expanded]: expanded })} onClick={showDetails}>
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
                  <span>{start.toFormat('MMM')}</span>
                  <span>{start.toFormat('d')}</span>
                </div>
                )
              : (
                <div>
                  <Avatar avatarUrl={creator.avatarUrl} url={creatorUrl} className={classes.avatar} tiny />
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
          <h3 className={cn(classes.title)}>{title}</h3>
          <HyloHTML className={classes.details} html={details} />
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
