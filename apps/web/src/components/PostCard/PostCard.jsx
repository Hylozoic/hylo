import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import React, { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import CardImageAttachments from 'components/CardImageAttachments'
import Icon from 'components/Icon'
import useRouteParams from 'hooks/useRouteParams'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { POST_PROP_TYPES } from 'store/models/Post'
import respondToEvent from 'store/actions/respondToEvent'
import getMe from 'store/selectors/getMe'
import EventBody from './EventBody'
import PostBody from './PostBody'
import PostFooter from './PostFooter'
import PostHeader from './PostHeader'
import PostGroups from './PostGroups'
import { cn } from 'util/index'

import classes from './PostCard.module.scss'

export { PostHeader, PostFooter, PostBody, PostGroups, EventBody }

export default function PostCard (props) {
  const {
    childPost,
    className,
    constrained,
    expanded,
    highlightProps,
    highlighted,
    group,
    mapDrawer,
    post,
    onAddReaction = () => {},
    onRemoveReaction = () => {},
    onRemovePost = () => {},
    onAddProposalVote = () => {},
    onRemoveProposalVote = () => {},
    onSwapProposalVote = () => {}
  } = props

  const postCardRef = useRef()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const dispatch = useDispatch()

  const currentUser = useSelector(getMe)

  const viewPostDetails = useViewPostDetails()

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
    if (shouldShowDetails(event.target)) viewPostDetails(post)
  }, [post, viewPostDetails])

  const postType = get('type', post)
  const isEvent = postType === 'event'
  const isFlagged = group && post.flaggedGroups && post.flaggedGroups.includes(group.id)

  const hasImage = post.attachments?.find(a => a.type === 'image') || false

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
        className={cn(
          'PostCard group/post-card rounded-xl cursor-pointer p-2 relative flex flex-col transition-all bg-card/50 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-2xl hover:shadow-lg mb-4 relative hover:z-[2] hover:scale-101 duration-400 ',
          classes[postType],
          {
            [classes.expanded]: expanded,
            [classes.constrained]: constrained,
            'border-accent/50': highlighted
          },
          className
        )}
        data-testid='post-card'
      >
        <div onClick={onClick}>
          <PostHeader
            post={post}
            routeParams={routeParams}
            highlightProps={highlightProps}
            currentUser={currentUser}
            isFlagged={isFlagged}
            constrained={constrained}
            hasImage={hasImage}
            onRemovePost={onRemovePost}
          />
        </div>
        <div onClick={onClick}>
          {post.attachments?.length > 0 && (
            <div className='mb-4'>
              <CardImageAttachments
                attachments={post.attachments || []}
                className='post-card'
                isFlagged={isFlagged && !post.clickthrough}
              />
            </div>
          )}
        </div>
        {isEvent && (
          <EventBody
            onClick={onClick}
            currentUser={currentUser}
            event={post}
            slug={routeParams.groupSlug}
            respondToEvent={handleRespondToEvent}
            constrained={constrained}
            isFlagged={isFlagged}
          />
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
              highlightProps={highlightProps}
              mapDrawer={mapDrawer}
              onAddProposalVote={onAddProposalVote}
              onRemoveProposalVote={onRemoveProposalVote}
              onSwapProposalVote={onSwapProposalVote}
            />
          </div>
        )}
        {/* <div onClick={onClick}>
          <PostGroups
            isPublic={post.isPublic}
            groups={post.groups}
            slug={routeParams.groupSlug}
            constrained={constrained}
          />
        </div> */}
        <PostFooter
          {...post}
          constrained={constrained}
          currentUser={currentUser}
          onClick={onClick}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          postId={post.id}
          mapDrawer={mapDrawer}
        />
      </div>
    </>
  )
}

PostCard.propTypes = {
  childPost: PropTypes.bool,
  post: PropTypes.shape(POST_PROP_TYPES),
  highlightProps: PropTypes.object,
  expanded: PropTypes.bool,
  constrained: PropTypes.bool,
  className: PropTypes.string
}
