import { filter, get, isFunction } from 'lodash/fp'
import { BookmarkCheck, Bookmark, Flag, Link2, Megaphone, MessageCircle, Trash2 } from 'lucide-react'
import PropTypes from 'prop-types'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import Avatar from 'components/Avatar'
import CardImageAttachments from 'components/CardImageAttachments'
import EmojiPicker from 'components/EmojiPicker'
import FlagGroupContent from 'components/FlagGroupContent'
import Icon from 'components/Icon'
import Tooltip from 'components/Tooltip'
import useReactionActions from 'hooks/useReactionActions'
import useRouteParams from 'hooks/useRouteParams'
import useViewPostDetails from 'hooks/useViewPostDetails'
import { POST_PROP_TYPES } from 'store/models/Post'
import respondToEvent from 'store/actions/respondToEvent'
import deletePostAction from 'store/actions/deletePost'
import removePostAction from 'store/actions/removePost'
import { savePost, unsavePost } from 'components/PostCard/PostHeader/PostHeader.store'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { groupUrl, personUrl } from '@hylo/navigation'
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
    chat,
    childPost,
    className,
    constrained,
    expanded,
    highlightProps,
    highlighted,
    group,
    isCurrentAction,
    mapDrawer,
    post,
    onAddReaction = () => {},
    onRemoveReaction = () => {},
    onRemovePost = () => {},
    onFlagPost = () => {},
    onAddProposalVote = () => {},
    onRemoveProposalVote = () => {},
    onSwapProposalVote = () => {}
  } = props

  const postCardRef = useRef()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Chat mode state
  const [isHovered, setIsHovered] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [flaggingVisible, setFlaggingVisible] = useState(false)

  const currentUser = useSelector(getMe)
  const currentUserResponsibilities = useSelector(state =>
    group ? getResponsibilitiesForGroup(state, { person: currentUser, groupId: group.id }) : []
  ).map(r => r.title)

  const viewPostDetails = useViewPostDetails()
  const { reactOnEntity, removeReactOnEntity } = useReactionActions()

  // Chat mode handlers
  const isCreator = currentUser?.id === post?.creator?.id
  const groupIds = post?.groups?.map(g => g.id) || []

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => {
    if (!isEmojiPickerOpen) setIsHovered(false)
  }, [isEmojiPickerOpen])

  const handleEmojiPickerOpen = useCallback((isOpen) => {
    setIsEmojiPickerOpen(isOpen)
    if (isOpen) setIsHovered(true)
    else setIsHovered(false)
  }, [])

  const handleReaction = useCallback((emojiFull) => {
    reactOnEntity({ emojiFull, entityType: 'post', postId: post.id, groupIds })
    onAddReaction(post, emojiFull)
  }, [post, groupIds, onAddReaction])

  const handleRemoveReaction = useCallback((emojiFull) => {
    removeReactOnEntity({ emojiFull, entityType: 'post', postId: post.id })
    onRemoveReaction(post, emojiFull)
  }, [post, onRemoveReaction])

  const handleSavePost = useCallback(() => {
    if (post.savedAt) {
      dispatch(unsavePost(post.id))
    } else {
      dispatch(savePost(post.id))
    }
  }, [post.savedAt, post.id])

  const deletePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to delete this post? You cannot undo this.'))) {
      dispatch(deletePostAction(post.id, group?.id))
      onRemovePost(post.id)
    }
  }, [post.id, group?.id, onRemovePost, t])

  const removePostWithConfirm = useCallback(() => {
    if (window.confirm(t('Are you sure you want to remove this post? You cannot undo this.'))) {
      dispatch(removePostAction(post.id, group?.slug))
      onRemovePost(post.id)
    }
  }, [post.id, group?.slug, onRemovePost, t])

  const showCreator = useCallback((event) => {
    event.stopPropagation()
    navigate(personUrl(post.creator?.id, group?.slug))
  }, [post.creator?.id, group?.slug, navigate])

  // Copy link function for chat mode
  const postUrl = `${window.location.protocol}//${window.location.host}/groups/${group?.slug}/post/${post.id}`
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(postUrl)
  }, [postUrl])

  // Chat mode action items
  const chatActionItems = useMemo(() => filter(item => isFunction(item.onClick), [
    { icon: <MessageCircle className='w-4 h-4 text-foreground' />, label: 'Reply', onClick: () => viewPostDetails(post), tooltip: t('Reply to post') },
    { icon: <Link2 className='w-4 h-4 text-foreground' />, label: 'Copy Link', onClick: copyLink, tooltip: t('Copy link') },
    { icon: post.savedAt ? <BookmarkCheck className='w-4 h-4 text-foreground' /> : <Bookmark className='w-4 h-4 text-foreground' />, label: post.savedAt ? t('Unsave Post') : t('Save Post'), onClick: handleSavePost, tooltip: post.savedAt ? t('Unsave post') : t('Save post') },
    { icon: <Flag className='w-4 h-4 text-foreground' />, label: 'Flag', onClick: !isCreator ? () => setFlaggingVisible(true) : null, tooltip: t('Flag post') },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Delete', onClick: isCreator ? deletePostWithConfirm : null, red: true, tooltip: t('Delete post') },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Remove From Group', onClick: !isCreator && currentUserResponsibilities.includes(RESP_MANAGE_CONTENT) ? removePostWithConfirm : null, red: true, tooltip: t('Remove post from group') }
  ]), [post, isCreator, currentUserResponsibilities, handleSavePost, copyLink, deletePostWithConfirm, removePostWithConfirm, viewPostDetails, t])

  const myEmojis = useMemo(() =>
    post.postReactions
      ? post.postReactions.filter(r => r.user.id === currentUser?.id).map(r => r.emojiFull)
      : []
  , [post.postReactions, currentUser?.id])

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
  const postTypeName = postType?.charAt(0).toUpperCase() + postType?.slice(1)
  const isEvent = postType === 'event'
  const isFlagged = group && post.flaggedGroups && post.flaggedGroups.includes(group.id)

  const hasImage = post.attachments?.find(a => a.type === 'image') || false

  // Get type icon for chat mode header
  const getTypeIcon = (type) => {
    const typeIconMap = {
      chat: 'Messages',
      offer: 'Offer',
      request: 'HandRaised',
      resource: 'Resource',
      project: 'Project',
      proposal: 'Proposal',
      event: 'Calendar',
      post: 'Post',
      discussion: 'Chat'
    }
    return typeIconMap[type] || 'Post'
  }

  // Chat mode layout
  if (chat) {
    return (
      <div
        className='relative'
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Chat-style header: Avatar + Name created a PostType + Timestamp + Announcement/Flag */}
        <div className='flex items-center gap-2 mb-2'>
          <div onClick={showCreator} className='cursor-pointer'>
            <Avatar avatarUrl={post.creator?.avatarUrl} large />
          </div>
          <div className='flex items-center gap-1 text-sm flex-1 justify-between'>
            <div className='flex items-center gap-1'>
              <span onClick={showCreator} className='font-bold text-base cursor-pointer hover:underline'>{post.creator?.name}</span>
              <span className='text-foreground/50'>{t('created a')}</span>
              <div className='flex items-center border-2 border-foreground/20 rounded text-xs gap-0.5 capitalize px-1 text-foreground/70 py1 mr-4'>
                <Icon name={getTypeIcon(postType)} className='w-4 h-4 text-foreground/70 items-center flex justify-center' />
                <span className='text-foreground/70'>{postTypeName}</span>
              </div>
              {post.announcement && (
                <span className='ml-2' data-tooltip-content={t('Announcement')} data-tooltip-id={`announcement-tt-${post.id}`}>
                  <Megaphone className='w-5 h-5 text-accent' />
                </span>
              )}
            </div>

            <span className='text-foreground/50'>{post.createdTimestamp}</span>
          </div>
          {isFlagged && (
            <Link
              to={groupUrl(group?.slug, 'moderation')}
              className='text-decoration-none'
              data-tooltip-content={t('See why this post was flagged')}
              data-tooltip-id={`post-flag-tt-${post.id}`}
            >
              <Icon name='Flag' className='text-xl text-accent font-bold' />
            </Link>
          )}
          <Tooltip delay={250} id={`announcement-tt-${post.id}`} />
          <Tooltip delay={250} id={`post-flag-tt-${post.id}`} />
        </div>

        {/* Hover action menu */}
        <div
          className={cn(
            'flex p-1 gap-2 absolute z-10 right-0 top-1 transition-all rounded-lg bg-background/100 dark:bg-darkening opacity-0 delay-100 scale-0',
            { 'opacity-100 scale-102': isHovered }
          )}
        >
          {chatActionItems.map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                'h-6 flex justify-center items-center rounded-lg bg-card hover:scale-110 transition-all border-2 border-transparent hover:border-foreground/50 shadow-lg hover:cursor-pointer',
                item.label === 'Reply' ? 'gap-1 px-2' : 'w-6'
              )}
              data-tooltip-content={item.label !== 'Reply' ? item.tooltip : undefined}
              data-tooltip-id='postcard-action-tt'
            >
              {item.icon}
              {item.label === 'Reply' && <span className='text-xs text-foreground'>{t('Reply')}</span>}
            </button>
          ))}
          <Tooltip delay={50} id='postcard-action-tt' />
          <EmojiPicker
            className='w-6 h-6 flex justify-center items-center rounded-lg bg-card border-2 border-transparent hover:border-foreground/50 transition-all shadow-lg hover:cursor-pointer'
            handleReaction={handleReaction}
            handleRemoveReaction={handleRemoveReaction}
            myEmojis={myEmojis}
            onOpenChange={handleEmojiPickerOpen}
          />
          {flaggingVisible && (
            <FlagGroupContent
              type='post'
              linkData={{ id: post.id, slug: group?.slug, type: 'post' }}
              onClose={() => setFlaggingVisible(false)}
              onFlag={() => onFlagPost({ post })}
            />
          )}
        </div>

        {/* The actual post card (without header since we have chat header) */}
        <div
          ref={postCardRef}
          className={cn(
            'PostCard group/post-card rounded-xl cursor-pointer p-1 ml-12 relative flex flex-col transition-all bg-card/50 dark:bg-card/100 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-2xl hover:shadow-lg mb-4 hover:z-[2] hover:scale-101 duration-400 hover:border-foreground/50',
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
              chat
              post={post}
              routeParams={routeParams}
              highlightProps={highlightProps}
              currentUser={currentUser}
              isCurrentAction={isCurrentAction}
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
      </div>
    )
  }

  // Default layout
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
          'PostCard group/post-card rounded-xl cursor-pointer p-1 relative flex flex-col transition-all bg-card/50 dark:bg-card/100 hover:bg-card/100 border-2 border-card/30 shadow-xl hover:shadow-2xl hover:shadow-lg mb-4 relative hover:z-[2] hover:scale-101 duration-400 hover:border-foreground/50',
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
            isCurrentAction={isCurrentAction}
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
  chat: PropTypes.bool,
  childPost: PropTypes.bool,
  className: PropTypes.string,
  constrained: PropTypes.bool,
  expanded: PropTypes.bool,
  group: PropTypes.object,
  highlightProps: PropTypes.object,
  onAddReaction: PropTypes.func,
  onFlagPost: PropTypes.func,
  onRemovePost: PropTypes.func,
  onRemoveReaction: PropTypes.func,
  post: PropTypes.shape(POST_PROP_TYPES)
}
