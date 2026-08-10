import { filter, isEmpty, isFunction, pick } from 'lodash/fp'
import { BookmarkCheck, Bookmark, Check, Flag, MessageCircle, Pencil, Trash2, X } from 'lucide-react'
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
import Tooltip from 'components/Tooltip'
import useReactionActions from 'hooks/useReactionActions'
import useViewPostDetails from 'hooks/useViewPostDetails'
import deletePost from 'store/actions/deletePost'
import removePost from 'store/actions/removePost'
import updatePost from 'store/actions/updatePost'
import getMe from 'store/selectors/getMe'
import getResponsibilitiesForGroup from 'store/selectors/getResponsibilitiesForGroup'
import { RESP_MANAGE_CONTENT } from 'store/constants'
import { groupUrl, personUrl } from '@hylo/navigation'
import { getLocaleFromLocalStorage } from 'util/locale'
import { hasActiveTextSelection, hasReadableContentSelection } from 'util/textSelectionTouch'
import { cn } from 'util/index'

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

  const postGroups = useMemo(() => {
    if (groups?.length) return groups
    return group ? [{ id: group.id, name: group.name, slug: group.slug }] : []
  }, [groups, group])

  const groupIds = useMemo(() => postGroups.map(g => g.id), [postGroups])

  useEffect(() => {
    if (linkPreview?.url) {
      setIsVideo(ReactPlayer.canPlay(linkPreview?.url))
    }
  }, [linkPreview?.url])

  const handleClick = event => {
    if (hasActiveTextSelection() || hasReadableContentSelection()) return

    // Cancel long press if currently active
    if (isLongPress) {
      setIsLongPress(false)
    // Don't open post details in these cases
    } else if (
      !editing &&
      !(event.target.getAttribute('target') === '_blank') &&
      !event.target.className.includes('image') &&
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
    filterEvents: (e) => !e.target?.closest?.('.global-postContent'),
    onFinish: () => {
      if (isPressDevice) setIsLongPress(true)
    }
  })

  // Reply means "I'm here to write" — the opened post focuses its comment box
  const showPost = useCallback(() => {
    viewPostDetails(post, { focusComment: true })
    setIsLongPress(false)
  }, [post, viewPostDetails])

  const showCreator = useCallback((event) => {
    event.stopPropagation()
    navigate(personUrl(creator.id, group.slug))
  }, [creator.id, group.slug])

  const editPost = useCallback((event) => {
    setIsHovered(false)
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

  const discardEdit = useCallback(() => {
    editorRef.current?.setContent(details)
    setEditing(false)
  }, [details])

  const handleEditCancel = useCallback(() => {
    discardEdit()
    return true
  }, [discardEdit])

  const handleEditCancelClick = useCallback((event) => {
    event.stopPropagation()
    if (window.confirm(t('Do you want to discard your edit?'))) {
      discardEdit()
    }
  }, [discardEdit, t])

  const handleEditSave = useCallback(contentHTML => {
    if (editorRef.current.isEmpty()) {
      return true
    }

    updatePostAction({
      ...post,
      details: contentHTML,
      groups: postGroups
    })
    setEditing(false)

    return true
  }, [post, postGroups, updatePostAction])

  const handleEditSaveClick = useCallback((event) => {
    event.stopPropagation()
    if (editorRef.current) {
      handleEditSave(editorRef.current.getHTML())
    }
  }, [handleEditSave])

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

  const moderationActionsGroupUrl = group && groupUrl(group.slug, 'moderation')

  const handleMouseEnter = () => {
    if (!editing) setIsHovered(true)
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

  const handleActionItemClick = useCallback((onClick) => () => {
    onClick()
  }, [])

  return (
    <Highlight {...highlightProps}>
      <div
        className={cn(
          'ChatPost_container rounded-lg pr-[15px] pb-[1px] px-1 py-1 -my-1 -mx-1 pt-1 relative transition-all group cursor-pointer border-2 border-transparent hover:border-foreground/50 select-text max-sm:pl-[15px]',
          showHeader ? 'py-1 mt-2' : ' ',
          className,
          {
            'bg-muted cursor-pointer': isLongPress,
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
              'opacity-100 scale-102': (isHovered || isLongPress) && !editing
            }
          )
          }
        >
          {actionItems.map(item => (
            <button
              key={item.label}
              onClick={handleActionItemClick(item.onClick)}
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
          <div className='relative z-0' onClick={handleClick}>
            {/* Avatar top-aligns with the name so the message text tucks in beside it */}
            <div onClick={showCreator} className='absolute left-0 top-0.5 cursor-pointer'>
              <Avatar avatarUrl={creator.avatarUrl} medium />
            </div>
            <div className='ml-[42px] flex items-baseline gap-2'>
              <div className='font-bold cursor-pointer' onClick={showCreator}>{creator.name}</div>
              <div className='text-xs text-foreground/50'>
                {DateTimeHelpers.toDateTime(createdAt, { locale: getLocaleFromLocalStorage() }).toFormat('t')}
                {editedAt && <span>&nbsp;({t('edited')} {DateTimeHelpers.toDateTime(editedAt, { locale: getLocaleFromLocalStorage() }).toFormat('t')})</span>}
              </div>
            </div>
          </div>
        )}
        {details && editing && (
          <div className='relative'>
            <HyloEditor
              containerClassName='ml-[42px] overflow-visible [&_p]:my-[3px]'
              contentHTML={details}
              groupIds={groupIds}
              onEscape={handleEditCancel}
              onEnter={handleEditSave}
              placeholder='Edit Post'
              ref={editorRef}
              showMenu
              className='py-2.5 pr-[50px] pl-2.5 m-0 overflow-y-auto max-h-[200px] cursor-text after:content-[""] after:block after:pb-[15px]'
            />
            <div className='absolute top-2.5 right-2.5 flex items-center gap-1.5 z-[1]'>
              <Check
                className='w-5 h-5 shrink-0 cursor-pointer text-selected'
                onClick={handleEditSaveClick}
                data-testid='Save'
              />
              <X
                className='w-5 h-5 shrink-0 cursor-pointer text-destructive'
                onClick={handleEditCancelClick}
                data-testid='Cancel'
              />
            </div>
          </div>
        )}
        {details && !editing && (
          <ClickCatcher groupSlug={group.slug} onClick={handleClick}>
            {/* break-words: an unbroken run (a long URL, a keysmash) must wrap rather
                than widen the message container — visible mostly on phone widths */}
            <div className={cn('ml-[42px] max-w-[calc(var(--chat-stream-width,750px)-50px)] cursor-text select-text break-words', { 'blur-sm': isFlagged })}>
              <HyloHTML className='w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words' html={details} />
            </div>
          </ClickCatcher>
        )}
        {isFlagged && <Link to={moderationActionsGroupUrl} className='absolute top-[calc(50%-14px)] ml-[50%] text-decoration-none' data-tooltip-content={t('See why this post was flagged')} data-tooltip-id='flag-tt'><Icon name='Flag' className='text-xl text-accent font-bold' /></Link>}
        <Tooltip
          delay={250}
          id='flag-tt'
        />
        {linkPreview?.url && linkPreviewFeatured && isVideo && (
          <div className='ml-[42px] mt-2 max-w-[calc(var(--chat-stream-width,750px)-50px)] overflow-hidden rounded-lg'>
            <Feature url={linkPreview.url} />
          </div>
        )}
        {linkPreview && !linkPreviewFeatured && (
          <LinkPreview {...pick(['title', 'description', 'imageUrl', 'url'], linkPreview)} className='px-5 pb-[0.6rem] pl-[42px] block [&>div]:mb-0 max-w-[calc(var(--chat-stream-width,750px)-50px)]' />
        )}
        <CardImageAttachments attachments={post.attachments} isFlagged={isFlagged && !post.clickthrough} forChatPost />
        {!isEmpty(fileAttachments) && (
          <CardFileAttachments attachments={fileAttachments} />
        )}
        {((postReactions && postReactions.length > 0) || commentsTotal > 0) && (
          <div className='w-full flex flex-row items-center flex-wrap gap-1.5 pl-[42px] mt-1 mb-[2px]'>
            {postReactions && postReactions.length > 0 && (
              <div onClick={handleClick}>
                <EmojiRow
                  className='!mr-0'
                  pillClassName='m-0 mr-1 mb-0 py-0 px-2 h-[22px] rounded-full text-xs items-center'
                  post={post}
                  currentUser={currentUser}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                />
              </div>
            )}
            {commentsTotal > 0 && (
              <div onClick={handleClick}>
                <span className='ChatPost_commenters inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors'>
                  <MessageCircle className='w-3 h-3 text-foreground/60 shrink-0' />
                  <span className='text-xs font-semibold text-foreground/70 leading-none' onClick={handleClick}>
                    {commentsTotal} {commentsTotal === 1 ? t('reply') : t('replies')}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Highlight>
  )
}
