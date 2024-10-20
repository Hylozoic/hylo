import cx from 'classnames'
import { get } from 'lodash/fp'
import React, { useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import CardImageAttachments from 'components/CardImageAttachments'
import Icon from 'components/Icon'
import { POST_PROP_TYPES } from 'store/models/Post'
import { postUrl, editPostUrl } from 'util/navigation'
import respondToEvent from 'store/actions/respondToEvent'
import getMe from 'store/selectors/getMe'
import EventBody from './EventBody'
import PostBody from './PostBody'
import PostFooter from './PostFooter'
import PostHeader from './PostHeader'
import PostGroups from './PostGroups'

import classes from './PostCard.module.scss'

export { PostHeader, PostFooter, PostBody, PostGroups, EventBody }

export default function PostCard (props) {
  const {
    childPost,
    className,
    constrained,
    currentGroupId,
    expanded,
    highlightProps,
    intersectionObserver,
    post,
    locationParams,
    querystringParams
  } = props

  const postCardRef = useRef()
  const { t } = useTranslation()
  const routeParams = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const currentUser = useSelector(getMe)

  const showDetails = useCallback(() => {
    navigate(postUrl(post.id, routeParams, { ...locationParams, ...querystringParams }))
  }, [post.id, routeParams, locationParams, querystringParams])

  const editPost = useCallback(() => {
    navigate(editPostUrl(post.id, routeParams, querystringParams))
  }, [post.id, routeParams, querystringParams])

  const handleRespondToEvent = useCallback((response) => {
    dispatch(respondToEvent(post, response))
  }, [post])

  // TODO: dupe of clickcatcher?
  const shouldShowDetails = useCallback(element => {
    if (element === postCardRef) return true
    if (
      element.tagName === 'A' ||
      element.tagName === 'LI' ||
      ['mention', 'topic'].includes(element.getAttribute('data-type'))
    ) return false

    const parent = element.parentElement

    if (parent) return shouldShowDetails(parent)
    return true
  })

  const onClick = useCallback(event => {
    if (shouldShowDetails(event.target)) showDetails()
  })

  useEffect(() => {
    if (intersectionObserver) {
      intersectionObserver.observe(postCardRef.current)
      return () => { intersectionObserver.disconnect() }
    }
  }, [intersectionObserver])

  const postType = get('type', post)
  const isEvent = postType === 'event'
  const isFlagged = post.flaggedGroups && post.flaggedGroups.includes(currentGroupId)

  const hasImage = post.attachments.find(a => a.type === 'image') || false

  return (
    <>
      {childPost &&
        <div className={classes.childPostLabelWrapper}>
          <div className={classes.childPostLabel}>
            <Icon name='Subgroup' className={classes.icon} />
            <span>{t('Post from')} <b>{t('child group')}</b></span>
          </div>
        </div>}
      <div
        ref={postCardRef}
        className={cx(
          classes.card,
          classes[postType],
          { [classes.expanded]: expanded },
          { [classes.constrained]: constrained },
          className
        )}
      >
        <div onClick={onClick}>
          <PostHeader
            {...post}
            routeParams={routeParams}
            highlightProps={highlightProps}
            currentUser={currentUser}
            editPost={editPost}
            isFlagged={isFlagged}
            constrained={constrained}
            hasImage={hasImage}
          />
        </div>
        <div onClick={onClick}>
          <CardImageAttachments attachments={post.attachments} className='post-card' isFlagged={isFlagged && !post.clickthrough} />
        </div>
        {isEvent && (
          <div className={classes.bodyWrapper}>
            <EventBody
              onClick={onClick}
              currentUser={currentUser}
              event={post}
              slug={routeParams.groupSlug}
              respondToEvent={handleRespondToEvent}
              constrained={constrained}
              isFlagged={isFlagged}
            />
          </div>
        )}
        {!isEvent && (
          <div>
            <PostBody
              {...post}
              onClick={onClick}
              slug={routeParams.groupSlug}
              constrained={constrained}
              currentUser={currentUser}
              isFlagged={isFlagged}
            />
          </div>
        )}
        <div onClick={onClick}>
          <PostGroups
            isPublic={post.isPublic}
            groups={post.groups}
            slug={routeParams.groupSlug}
            constrained={constrained}
          />
        </div>
        <PostFooter
          {...post}
          onClick={onClick}
          constrained={constrained}
          currentUser={currentUser}
          postId={post.id}
        />
      </div>
    </>
  )
}

PostCard.propTypes = {
  childPost: PropTypes.bool,
  routeParams: PropTypes.object,
  post: PropTypes.shape(POST_PROP_TYPES),
  highlightProps: PropTypes.object,
  expanded: PropTypes.bool,
  constrained: PropTypes.bool,
  className: PropTypes.string,
  locationParams: PropTypes.object,
  querystringParams: PropTypes.object
}
