import { filter, isEmpty, isFunction, pick } from 'lodash/fp'
import { BookmarkCheck, Bookmark, Check, Flag, MessageCircle, Pencil, Pin, PinOff, Trash2, X } from 'lucide-react'
import { DateTimeHelpers, MAX_PINNED_POSTS_PER_VIEW } from '@hylo/shared'
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useLongPress } from 'use-long-press'
import isPlayableVideoUrl from 'util/isPlayableVideoUrl'
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
import { groupUrl, personUrl, spaceUrl } from '@hylo/navigation'
import { useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { getLocaleFromLocalStorage } from 'util/locale'
import { hasActiveTextSelection, hasReadableContentSelection } from 'util/textSelectionTouch'
import pinPostAction from 'store/actions/pinPost'
import useCurrentPinnableView from 'hooks/useCurrentPinnableView'
import { cn } from 'util/index'

// Tall messages are clipped to this height until the reader asks for the rest,
// so one long post can't push the rest of the conversation off screen
const MAX_COLLAPSED_DETAILS_HEIGHT = 200
// Only clip when doing so buys back meaningful height — a message a hair over
// the limit would otherwise gain a "See More" that hides a single line
const COLLAPSE_SLACK = 40
// Fade the clipped text itself rather than painting a gradient over it: the
// row's background shifts between default, hover and highlighted states
const COLLAPSED_DETAILS_FADE = 'linear-gradient(to bottom, black calc(100% - 40px), transparent)'
// Always clip until expanded so Virtuoso measures the collapsed height on first
// paint. Measuring full height and then collapsing fights atBottom / shortSizeAlign
// in a loop at the bottom of the list.
const clippedDetailsStyle = {
  maxHeight: MAX_COLLAPSED_DETAILS_HEIGHT,
  overflow: 'hidden'
}
const collapsedDetailsFadeStyle = {
  maskImage: COLLAPSED_DETAILS_FADE,
  WebkitMaskImage: COLLAPSED_DETAILS_FADE
}

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
  const pinnableView = useCurrentPinnableView()
  const { parentGroupSlug, spaceSlug } = useGroupRouteOpts()

  const [editing, setEditing] = useState(false)
  const [flaggingVisible, setFlaggingVisible] = useState(false)
  const [isLongPress, setIsLongPress] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const [detailsOverflowing, setDetailsOverflowing] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const detailsRef = useRef()

  const isCreator = currentUser.id === creator.id
  const isFlagged = useMemo(() => group && post.flaggedGroups && post.flaggedGroups.some(id => String(id) === String(group.id)), [group, post.flaggedGroups])

  // The flag badge's tooltip: agreement titles and reporter notes from this
  // group's active moderation actions, falling back to the generic line
  const flagReasons = useMemo(() => {
    const actions = (post.moderationActions || []).filter(action =>
      action.status === 'active' && (!action.groupId || String(action.groupId) === String(group?.id)))
    const reasons = []
    actions.forEach(action => {
      const agreements = action.agreements?.items || action.agreements || []
      agreements.forEach(agreement => agreement?.title && reasons.push(agreement.title))
      const platform = action.platformAgreements?.items || action.platformAgreements || []
      platform.forEach(pa => pa?.text && reasons.push(pa.text))
      if (action.text) reasons.push(action.text)
    })
    const unique = [...new Set(reasons)]
    return unique.length ? unique.join(' · ') : t('See why this post was flagged')
  }, [post.moderationActions, group?.id, t])

  const hasImageAttachments = useMemo(
    () => (post.attachments || []).some(attachment => attachment?.type === 'image'),
    [post.attachments]
  )

  const postGroups = useMemo(() => {
    if (post.groups?.length) return post.groups
    return group ? [{ id: group.id, name: group.name, slug: group.slug }] : []
  }, [post.groups, group])

  const groupIds = useMemo(() => postGroups.map(g => g.id), [postGroups])

  const previewUrl = linkPreview?.url || linkPreview?.ref?.url
  const showFeaturedVideo = linkPreviewFeatured && isPlayableVideoUrl(previewUrl)

  // Measure rather than count characters: what matters is the height on screen,
  // which shifts with images, embeds and the reader's chosen stream width.
  // useLayoutEffect so See More is decided before paint — the clip itself is
  // already on from the first render (see clippedDetailsStyle).
  useLayoutEffect(() => {
    const element = detailsRef.current
    if (!element) return
    const measure = () => setDetailsOverflowing(element.offsetHeight > MAX_COLLAPSED_DETAILS_HEIGHT + COLLAPSE_SLACK)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [details, editing])

  const handleToggleDetails = useCallback((event) => {
    event.stopPropagation()
    setDetailsExpanded(expanded => !expanded)
  }, [])

  const handleClick = event => {
    if (hasActiveTextSelection() || hasReadableContentSelection()) return

    // Cancel long press if currently active
    if (isLongPress) {
      setIsLongPress(false)
    // Don't open post details in these cases
    } else if (
      !editing &&
      // closest: the click often lands on an icon or span inside the link
      !event.target.closest?.('a[target="_blank"]') &&
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

  const pinnedPostIds = (pinnableView?.pinnedPostIds || []).map(pid => String(pid))
  const pinned = pinnedPostIds.includes(String(id))
  const atPinCap = pinnedPostIds.length >= MAX_PINNED_POSTS_PER_VIEW && !pinned
  const canShowPin = currentUserResponsibilities.includes(RESP_MANAGE_CONTENT) &&
    !!pinnableView?.id &&
    !!group?.id
  const pinAtCap = canShowPin && atPinCap
  const canPin = canShowPin && (pinned || !atPinCap)
  const handlePinPost = useCallback(() => {
    if (!pinnableView?.id || !group?.id) return
    dispatch(pinPostAction(id, pinnableView.id, group.id, post))
  }, [dispatch, id, pinnableView?.id, group?.id, post])

  const actionItems = filter(item => isFunction(item.onClick) || item.disabled, [
    // { icon: 'Copy', label: 'Copy Link', onClick: copyLink },
    { icon: <MessageCircle className='w-4 h-4 text-foreground' />, label: 'Reply', onClick: showPost, tooltip: 'Reply to post' },
    // TODO: Edit disabled in mobile environments due to issue with keyboard management and autofocus of field
    { icon: <Pencil className='w-4 h-4 text-foreground' />, label: 'Edit', onClick: (isCreator && !isLongPress) ? editPost : null, tooltip: 'Edit post' },
    { icon: savedAt ? <BookmarkCheck className='w-4 h-4 text-foreground' /> : <Bookmark className='w-4 h-4 text-foreground' />, label: savedAt ? t('Unsave Post') : t('Save Post'), onClick: handleSavePost, tooltip: savedAt ? 'Unsave post' : 'Save post' },
    { icon: pinned ? <PinOff className='w-4 h-4 text-foreground' /> : <Pin className={cn('w-4 h-4', pinAtCap ? 'text-foreground/40' : 'text-foreground')} />, label: pinned ? t('Unpin from View') : t('Pin to View'), onClick: canPin ? handlePinPost : null, disabled: pinAtCap, tooltip: pinAtCap ? t('You can only pin 3 posts') : (pinned ? t('Unpin from View') : t('Pin to View')) },
    { icon: <Flag className='w-4 h-4 text-foreground' />, label: 'Flag', onClick: !isCreator ? () => { setFlaggingVisible(true) } : null, tooltip: 'Flag post' },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Delete', onClick: isCreator ? deletePostWithConfirm : null, red: true, tooltip: 'Delete post' },
    { icon: <Trash2 className='w-4 h-4 text-destructive' />, label: 'Remove From Group', onClick: !isCreator && currentUserResponsibilities.includes(RESP_MANAGE_CONTENT) ? removePostWithConfirm : null, red: true, tooltip: 'Remove post from group' }
  ])

  const myEmojis = useMemo(() => postReactions ? postReactions.filter(reaction => reaction.user.id === currentUser.id).map((reaction) => reaction.emojiFull) : [], [postReactions, currentUser])

  const moderationActionsGroupUrl = spaceSlug && parentGroupSlug
    ? spaceUrl(parentGroupSlug, spaceSlug, '/moderation')
    : (group && groupUrl(group.slug, 'moderation'))

  // White flag on a red disc, linking to the moderation queue; hovering shows
  // the flag's reasons. Rides beside whichever content block was flagged.
  const flagBadge = (
    <Link
      to={moderationActionsGroupUrl}
      aria-label={t('See why this post was flagged')}
      data-tooltip-content={flagReasons}
      data-tooltip-id='flag-tt'
      onClick={event => event.stopPropagation()}
      className='shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-white shadow-md hover:scale-110 transition-transform'
    >
      <Flag className='w-3.5 h-3.5' strokeWidth={2.5} fill='currentColor' />
    </Link>
  )

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

  const handleActionItemClick = useCallback((onClick) => (event) => {
    event.stopPropagation()
    onClick(event)
  }, [])

  return (
    <Highlight {...highlightProps}>
      <div
        className={cn(
          'ChatPost_container rounded-lg pr-[15px] pb-[1px] px-1 py-1 -my-1 -mx-1 pt-1 relative transition-all group cursor-pointer border-2 border-transparent select-text max-sm:pl-[15px]',
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
              type='button'
              onClick={item.disabled ? (e) => { e.stopPropagation(); e.preventDefault() } : handleActionItemClick(item.onClick)}
              className={cn(
                'h-6 flex justify-center items-center rounded-lg bg-card hover:scale-110 transition-all border-2 border-transparent hover:border-foreground/50 shadow-lg hover:cursor-pointer',
                item.label === 'Reply' ? 'gap-1 px-2' : 'w-6',
                item.disabled && 'opacity-40 cursor-default hover:scale-100 hover:border-transparent'
              )}
              data-tooltip-content={item.label !== 'Reply' ? item.tooltip : undefined}
              data-tooltip-id='action-tt'
              title={item.disabled ? item.tooltip : undefined}
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
              <div className='font-bold cursor-pointer flex items-center gap-1.5' onClick={showCreator}>
                {creator.name}
                {pinned && (
                  <Pin className='w-3.5 h-3.5 shrink-0 text-[hsl(45_65%_45%)] dark:text-[hsl(45_65%_62%)]' strokeWidth={2.5} aria-hidden='true' />
                )}
              </div>
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
          <>
            {/* Flagged text gets its badge at the end of the line: the flex row
                lets the text block keep its natural width with the badge
                centered just past it */}
            <div className={cn(isFlagged && 'flex items-center gap-2')}>
              <ClickCatcher groupSlug={group.slug} onClick={handleClick}>
                {/* break-words: an unbroken run (a long URL, a keysmash) must wrap rather
                    than widen the message container — visible mostly on phone widths */}
                <div
                  data-testid='chat-post-details'
                  className={cn('ml-[42px] max-w-[calc(var(--chat-stream-width,750px)-50px)] cursor-text select-text break-words', { 'blur-sm': isFlagged })}
                  style={!detailsExpanded
                    ? (detailsOverflowing
                        ? { ...clippedDetailsStyle, ...collapsedDetailsFadeStyle }
                        : clippedDetailsStyle)
                    : undefined}
                >
                  {/* Inner wrapper stays unclipped so its height is the message's true height */}
                  <div ref={detailsRef}>
                    <HyloHTML className='w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 break-words' html={details} />
                  </div>
                </div>
              </ClickCatcher>
              {isFlagged && !hasImageAttachments && flagBadge}
            </div>
            {detailsOverflowing && (
              <button
                type='button'
                onClick={handleToggleDetails}
                className='block ml-[42px] mt-1 text-xs font-semibold text-focus hover:underline'
              >
                {detailsExpanded ? t('See Less') : t('See More')}
              </button>
            )}
          </>
        )}
        <Tooltip
          delay={250}
          id='flag-tt'
        />
        {showFeaturedVideo && (
          <div className='ml-[42px] mt-2 max-w-[calc(var(--chat-stream-width,750px)-50px)] overflow-hidden rounded-lg'>
            <Feature url={previewUrl} />
          </div>
        )}
        {linkPreview && !showFeaturedVideo && (
          <LinkPreview {...pick(['title', 'description', 'imageUrl', 'url'], linkPreview.ref || linkPreview)} className='px-5 pb-[0.6rem] pl-[42px] block [&>div]:mb-0 max-w-[calc(var(--chat-stream-width,750px)-50px)]' />
        )}
        {/* Chat has no clickthrough affordance, so a flagged post's media stays
            blurred like its text rather than honoring a clickthrough recorded
            on another surface */}
        {/* The wrapper makes empty space beside the attachments open the post,
            like the header and text regions; tile clicks stop propagation and
            open the lightbox instead. When flagged media is present the badge
            rides this row, centered beside the tiles */}
        <div className={cn(isFlagged && hasImageAttachments && 'flex items-center gap-2')} onClick={handleClick}>
          <CardImageAttachments attachments={post.attachments} isFlagged={isFlagged} forChatPost className='min-w-0' />
          {isFlagged && hasImageAttachments && flagBadge}
          {!isEmpty(fileAttachments) && (
            <CardFileAttachments attachments={fileAttachments} className={cn({ 'blur-sm': isFlagged })} />
          )}
        </div>
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
