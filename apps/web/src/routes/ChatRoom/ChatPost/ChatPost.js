import { filter, isEmpty, isFunction, pick } from 'lodash/fp'
import { DateTime } from 'luxon'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import ReactPlayer from 'react-player'
import { useLongPress } from 'use-long-press'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import ClickCatcher from 'components/ClickCatcher'
import CardFileAttachments from 'components/CardFileAttachments'
import CardImageAttachments from 'components/CardImageAttachments'
import EmojiRow from 'components/EmojiRow'
import EmojiPicker from 'components/EmojiPicker'
import FlagContent from 'components/FlagContent'
import Highlight from 'components/Highlight'
import HyloEditor from 'components/HyloEditor'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import Feature from 'components/PostCard/Feature'
import LinkPreview from 'components/LinkPreview'
import RoundImageRow from 'components/RoundImageRow'
import useReactionActions from 'hooks/useReactionActions'
import useViewPostDetails from 'hooks/useViewPostDetails'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import isWebView from 'util/webView'
import updatePost from 'store/actions/updatePost'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { personUrl } from 'util/navigation'
import { cn } from 'util/index'

import styles from './ChatPost.module.scss'

export default function ChatPost ({
  className,
  group,
  highlightProps,
  post,
  showHeader = true,
  onAddReaction = () => {},
  onRemoveReaction = () => {}
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
    myReactions,
    postReactions
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
    if (window.confirm('Are you sure you want to delete this post? You cannot undo this.')) {
      dispatch(deletePost(id, group.id))
    }
    event.stopPropagation()
    return true
  })

  const removePostWithConfirm = useCallback((event) => {
    if (window.confirm('Are you sure you want to remove this post? You cannot undo this.')) {
      dispatch(removePost(id, group.slug))
    }
    event.stopPropagation()
    return true
  })

  const actionItems = filter(item => isFunction(item.onClick), [
    // { icon: 'Pin', label: pinned ? 'Unpin' : 'Pin', onClick: pinPost },
    // { icon: 'Copy', label: 'Copy Link', onClick: copyLink },
    { icon: 'Replies', label: 'Reply', onClick: showPost },
    // TODO: Edit disabled in mobile environments due to issue with keyboard management and autofocus of field
    { icon: 'Edit', label: 'Edit', onClick: (isCreator && !isLongPress) ? editPost : null },
    { icon: 'Flag', label: 'Flag', onClick: !isCreator ? () => { setFlaggingVisible(true) } : null },
    { icon: 'Trash', label: 'Delete', onClick: isCreator ? deletePostWithConfirm : null, red: true },
    { icon: 'Trash', label: 'Remove From Group', onClick: !isCreator && currentUserResponsibilities.includes(RESP_MANAGE_CONTENT) ? removePostWithConfirm : null, red: true }
  ])

  const myEmojis = myReactions ? myReactions.map((reaction) => reaction.emojiFull) : []

  const commenterAvatarUrls = commenters.map(p => p.avatarUrl)

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
        className={cn('rounded-lg', className, styles.container, {
          [styles.longPressed]: isLongPress,
          [styles.hovered]: isHovered
        })}
        ref={ref}
        {...bindLongPress()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className={styles.actionBar}>
          {actionItems.map(item => (
            <Button
              key={item.label}
              noDefaultStyles
              borderRadius='0'
              onClick={item.onClick}
              className={styles.actionItem}
            >
              <Icon name={item.icon} />
            </Button>
          ))}
          <EmojiPicker
            className={styles.actionItem}
            handleReaction={handleReaction}
            handleRemoveReaction={handleRemoveReaction}
            myEmojis={myEmojis}
            onOpenChange={handleEmojiPickerOpen}
          />
          {flaggingVisible && (
            <FlagContent
              type='post'
              linkData={{ id, slug: group.slug, type: 'post' }}
              onClose={() => setFlaggingVisible(false)}
            />
          )}
        </div>

        {showHeader && (
          <div className={styles.header} onClick={handleClick}>
            <div onClick={showCreator} className={styles.author}>
              <Avatar avatarUrl={creator.avatarUrl} className={styles.avatar} />
              <div className={styles.name}>{creator.name}</div>
            </div>
            <div className={styles.date}>
              {DateTime.fromISO(createdAt).toFormat('t')}
              {editedAt && <span>&nbsp;({t('edited')} {DateTime.fromISO(editedAt).toFormat('t')})</span>}
            </div>
          </div>
        )}
        {details && editing && (
          <HyloEditor
            contentHTML={details}
            groupIds={groupIds}
            onEscape={handleEditCancel}
            onEnter={handleEditSave}
            placeholder='Edit Post'
            ref={editorRef}
            showMenu={!isWebView()}
            className={cn(styles.postContentContainer, styles.editing, styles.postContent)}
          />
        )}
        {details && !editing && (
          <ClickCatcher groupSlug={group.slug} onClick={handleClick}>
            <div className={styles.postContentContainer}>
              <HyloHTML className={styles.postContent} html={details} />
            </div>
          </ClickCatcher>
        )}
        {linkPreview?.url && linkPreviewFeatured && isVideo && (
          <Feature url={linkPreview.url} />
        )}
        {linkPreview && !linkPreviewFeatured && (
          <LinkPreview {...pick(['title', 'description', 'imageUrl', 'url'], linkPreview)} className={styles.linkPreview} />
        )}
        <CardImageAttachments attachments={post.attachments} isFlagged={false} forChatPost />
        {!isEmpty(fileAttachments) && (
          <CardFileAttachments attachments={fileAttachments} />
        )}
        <EmojiRow
          className={cn(styles.emojis, { [styles.noEmojis]: !postReactions || postReactions.length === 0 })}
          post={post}
          currentUser={currentUser}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
        />
        {commentsTotal > 0 && (
          <span className={styles.commentsContainer}>
            <RoundImageRow imageUrls={commenterAvatarUrls.slice(0, 3)} className={styles.commenters} onClick={handleClick} small />
            <span className={styles.commentsCaption} onClick={handleClick}>
              {commentsTotal} {commentsTotal === 1 ? 'reply' : 'replies'}
            </span>
          </span>
        )}
      </div>
    </Highlight>
  )
}
