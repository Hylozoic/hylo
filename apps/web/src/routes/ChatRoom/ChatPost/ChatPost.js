import { filter, isEmpty, isFunction, pick } from 'lodash/fp'
import { BookmarkCheck, Bookmark, Flag, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import ReactPlayer from 'react-player'
import { useLongPress } from 'use-long-press'
import Avatar from 'components/Avatar'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import EmojiRow from 'components/EmojiRow'
import EmojiPicker from 'components/EmojiPicker'
import FlagGroupContent from 'components/FlagGroupContent'
import Highlight from 'components/Highlight'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Feature from 'components/PostCard/Feature'
import { savePost, unsavePost } from 'components/PostCard/PostHeader/PostHeader.store'
import LinkPreview from 'components/LinkPreview'
import RoundImageRow from 'components/RoundImageRow'
import Tooltip from 'components/Tooltip'
import useReactionActions from 'hooks/useReactionActions'
import useViewPostDetails from 'hooks/useViewPostDetails'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import isWebView from 'util/webView'
import updatePost from 'store/actions/updatePost'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { groupUrl, personUrl } from '@hylo/navigation'
import { getLocaleFromLocalStorage } from 'util/locale'
import { cn } from 'util/index'

import styles from './ChatPost.module.scss'

export default function ChatPost ({
  className,
  group,
  highlightProps,
  highlighted,
  post,
  showHeader = true,
  onAddReaction = () => {},
  onFlagPost = () => {},
  onRemoveReaction = () => {},
  onRemovePost = () => {}
}) {
  const {
    commenters,
    commentsTotal,
    createdAt,
    creator,
    details,
    editedAt,
    fileAttachments,
    groups, // TODO: why pass this in, why not pull from getGroupFromSlug?
    id,
    linkPreview,
    linkPreviewFeatured,
    postReactions,
    savedAt
  } = post

  const dispatch = useDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ref = useRef()
  const editorRef = useRef()
  const isPressDevice = !window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const currentUser = useSelector(getMe)
  const currentUserResponsibilities = useSelector(state => getResponsibilitiesForGroup(state, { person: currentUser, groupId: group.id })).map(r => r.title)

  const [editing, setEditing] = useState(false)
  const [isVideo, setIsVideo] = useState()
  const [flaggingVisible, setFlaggingVisible] = useState(false)
  const [isLongPress, setIsLongPress] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)

  const isCreator = currentUser.id === creator.id
  const isFlagged = useMemo(() => group && post.flaggedGroups && post.flaggedGroups.includes(group.id), [group, post.flaggedGroups])

  const groupIds = groups.map(g => g.id)

  useEffect(() => {
    if (linkPreview?.url) {
      setIsVideo(ReactPlayer.canPlay(linkPreview?.url))
    }
  }, [linkPreview?.url])

  const handleClick = event => {
    // Cancel long press if currently active
    if (isLongPress) {
      setIsLongPress(false)
    // Don't open post details in these cases
    } else if (
      !editing &&
      !(event.target.getAttribute('target') === '_blank') &&
      !event.target.className.includes(styles.imageInner) &&
      !event.target.className.includes('icon-Smiley')
    ) {
      showPost()
    }
  }

  const updatePostAction = useCallback((post) => dispatch(updatePost(post)), [])

  const viewPostDetails = useViewPostDetails()

  const bindLongPress = useLongPress(() => {
    setIsLongPress(false)
  }, {
    onFinish: () => {
      if (isPressDevice) setIsLongPress(true)
    }
  })

  const showPost = useCallback(() => {
    viewPostDetails(post)
    setIsLongPress(false)
  }, [post, viewPostDetails])

  const showCreator = useCallback((event) => {
    event.stopPropagation()
    navigate(personUrl(creator.id, group.slug))
  }, [creator.id, group.slug])

  const editPost = useCallback((event) => {
    setEditing(true)
    setTimeout(() => {
      editorRef.current.focus('end')
    }, 500)
    event.stopPropagation()
    return true
  }, [])

  const { reactOnEntity, removeReactOnEntity } = useReactionActions()
  const handleReaction = (emojiFull) => {
    reactOnEntity({ emojiFull, entityType: 'post', postId: id, groupIds })
    onAddReaction(post, emojiFull)
    setIsLongPress(false)
  }
  const handleRemoveReaction = (emojiFull) => {
    removeReactOnEntity({ emojiFull, entityType: 'post', postId: id })
    onRemoveReaction(post, emojiFull)
  }

  const handleEditCancel = useCallback(() => {
    editorRef.current.setContent(details)
    setEditing(false)
    return true
  }, [details])

  const handleEditSave = contentHTML => {
    if (editorRef.current.isEmpty()) {
      // Do nothing and stop propagation
      return true
    }

    post.details = contentHTML
    post.topicNames = post.topics?.map((t) => t.name) // Make sure topic stays on the post
    updatePostAction(post)
    setEditing(false)

    // Tell Editor this keyboard event was handled and to end propagation.
    return true
  }

  const deletePostWithConfirm = useCallback((event) => {
    if (window.confirm(t('Are you sure you want to delete this post? You cannot undo this.'))) {
      dispatch(deletePost(id, group.id))
      onRemovePost(post.id)
    }
    event.stopPropagation()
    return true
  })

  const removePostWithConfirm = useCallback((event) => {
    if (window.confirm(t('Are you sure you want to remove this post? You cannot undo this.'))) {
      dispatch(removePost(id, group.slug))
      onRemovePost(post.id)
    }
    event.stopPropagation()
    return true
  })

  const handleSavePost = useCallback(() => {
    if (savedAt) {
      dispatch(unsavePost(id))
    } else {
      dispatch(savePost(id))
    }
  }, [savedAt, id])

  const actionItems = filter(item => isFunction(item.onClick), [
    // { icon: 'Copy', label: 'Copy Link', onClick: copyLink },
    { icon: <MessageCircle className='w-4 h-4 text-foreground' />, label: 'Reply', onClick: showPost, tooltip: 'Reply to post' },
    // TODO: Edit disabled in mobile environments due to issue with keyboard management and autofocus of field
    { icon: <Pencil className='w-4 h-4 text-foreground' />, label: 'Edit', onClick: (isCreator && !isLongPress) ? editPost : null, tooltip: 'Edit post' },
    { icon: savedAt ? <BookmarkCheck className='w-4 h-4 text-foreground' /> : <Bookmark className='w-4 h-4 text-foreground' />, label: savedAt ? t('Unsave Post') : t('Save Post'), onClick: handleSavePost, tooltip: savedAt ? 'Unsave post' : 'Save post' },
    { icon: <Flag className='w-4 h-4 text-foreground' />, label: 'Flag', onClick: !isCreator ? () => { setFlaggingVisible(true) } : null, tooltip: 'Flag post' },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Delete', onClick: isCreator ? deletePostWithConfirm : null, red: true, tooltip: 'Delete post' },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Remove From Group', onClick: !isCreator && currentUserResponsibilities.includes(RESP_MANAGE_CONTENT) ? removePostWithConfirm : null, red: true, tooltip: 'Remove post from group' }
  ])

  const myEmojis = useMemo(() => postReactions ? postReactions.filter(reaction => reaction.user.id === currentUser.id).map((reaction) => reaction.emojiFull) : [], [postReactions, currentUser])

  const commenterAvatarUrls = commenters.map(p => p.avatarUrl)

  const moderationActionsGroupUrl = group && groupUrl(group.slug, 'moderation')

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    if (!isEmojiPickerOpen) {
      setIsHovered(false)
    }
  }

  const handleEmojiPickerOpen = useCallback((isOpen) => {
    setIsEmojiPickerOpen(isOpen)
    // Keep hover state while picker is open
    if (isOpen) {
      setIsHovered(true)
    } else {
      setIsHovered(false)
    }
  }, [])

  return (
    <Highlight {...highlightProps}>
      <div
        className={cn(
          'ChatPost_container rounded-lg pr-[15px] pb-[1px] px-1 py-1 -my-1 -mx-1 pt-1 relative transition-all group cursor-pointer border-2 border-transparent hover:border-foreground/50',
          showHeader ? 'py-1 mt-2' : ' ',
          className,
          styles.container,
          {
            [styles.longPressed]: isLongPress,
            [styles.hovered]: isHovered,
            'bg-card shadow-lg cursor-pointer': isHovered,
            'bg-accent/30': highlighted
          }
        )}
        ref={ref}
        {...bindLongPress()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={
          cn(
            'flex p-1 gap-2 absolute z-10 right-1 -top-0 transition-all rounded-lg cursor-normal bg-background/100 dark:bg-darkening opacity-0 delay-100 scale-0',
            {
              'opacity-100 scale-102': isHovered
            }
          )
          }
        >
          {actionItems.map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={cn(
                'h-6 flex justify-center items-center rounded-lg bg-card hover:scale-110 transition-all border-2 border-transparent hover:border-foreground/50 shadow-lg hover:cursor-pointer',
                item.label === 'Reply' ? 'gap-1 px-2' : 'w-6'
              )}
              data-tooltip-content={item.label !== 'Reply' ? item.tooltip : undefined}
              data-tooltip-id='action-tt'
            >
              {item.icon}
              {item.label === 'Reply' && <span className='text-xs text-foreground'>{t('Reply')}</span>}
            </button>
          ))}
          <Tooltip
            delay={50}
            id='action-tt'
          />
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
              linkData={{ id, slug: group.slug, type: 'post' }}
              onClose={() => setFlaggingVisible(false)}
              onFlag={() => onFlagPost({ post })}
            />
          )}
        </div>

        {showHeader && (
          <div className='flex justify-between items-center relative z-0' onClick={handleClick}>
            <div onClick={showCreator} className='flex items-center gap-2 relative -left-[8px] sm:-left-0'>
              <Avatar avatarUrl={creator.avatarUrl} large />
              <div className='w-full font-bold'>{creator.name}</div>
            </div>
            <div className='text-xs text-foreground/50'>
              {DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('t')}
              {editedAt && <span>&nbsp;({t('edited')} {DateTimeHelpers.toDateTime(editedAt, { locale: getLocaleFromLocalStorage() }).toFormat('t')})</span>}
            </div>
          </div>
        )}
        {details && editing && (
          <HyloEditor
            containerClassName={styles.postContentContainer}
            contentHTML={details}
            groupIds={groupIds}
            onEscape={handleEditCancel}
            onEnter={handleEditSave}
            placeholder='Edit Post'
            ref={editorRef}
            showMenu={!isWebView()}
            className={cn(styles.editing, 'p-0 m-0')}
          />
        )}
        {details && !editing && (
          <ClickCatcher groupSlug={group.slug} onClick={handleClick}>
            <div className={cn('ml-12', { [styles.isFlagged]: isFlagged })}>
              <HyloHTML className='w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0' html={details} />
            </div>
          </ClickCatcher>
        )}
        {isFlagged && <Link to={moderationActionsGroupUrl} className='absolute top-[calc(50%-14px)] ml-[50%] text-decoration-none' data-tooltip-content={t('See why this post was flagged')} data-tooltip-id='flag-tt'><Icon name='Flag' className='text-xl text-accent font-bold' /></Link>}
        <Tooltip
          delay={250}
          id='flag-tt'
        />
        {linkPreview?.url && linkPreviewFeatured && isVideo && (
          <Feature url={linkPreview.url} />
        )}
        {linkPreview && !linkPreviewFeatured && (
          <LinkPreview {...pick(['title', 'description', 'imageUrl', 'url'], linkPreview)} className={styles.linkPreview} />
        )}
        <CardImageAttachments attachments={post.attachments} isFlagged={isFlagged && !post.clickthrough} forChatPost />
        {!isEmpty(fileAttachments) && (
          <CardFileAttachments attachments={fileAttachments} />
        )}
        <div className='w-full flex flex-row gap-2 justify-between'>
          {postReactions && postReactions.length > 0 && (
            <div onClick={handleClick}>
              <EmojiRow
                className={cn(styles.emojis, { [styles.noEmojis]: !postReactions || postReactions.length === 0 })}
                post={post}
                currentUser={currentUser}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
              />
            </div>
          )}
          {commentsTotal > 0 && (
            <div onClick={handleClick}>
              <span className='ChatPost_commenters bg-darkening/5 rounded-lg py-2 px-2 xs:ml-[48px] mb-[2px] items-center justify-center inline-flex'>
                <RoundImageRow imageUrls={commenterAvatarUrls.slice(0, 3)} className={styles.commenters} onClick={handleClick} small />
                <span className='text-sm text-foreground' onClick={handleClick}>
                  {commentsTotal} {commentsTotal === 1 ? 'reply' : 'replies'}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Highlight>
  )
}
