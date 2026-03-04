import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useResizeDetector } from 'react-resize-detector'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import PropTypes from 'prop-types'
import { get, throttle, find } from 'lodash/fp'
import { Helmet } from 'react-helmet'
import { AnalyticsEvents, TextHelpers } from '@hylo/shared'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
import ActionCompletionResponsesDialog from 'components/ActionCompletionResponsesDialog'
import CardImageAttachments from 'components/CardImageAttachments'
import {
  PostBody,
  PostFooter,
  PostHeader,
  PostGroups,
  EventBody
} from 'components/PostCard'
import ScrollListener from 'components/ScrollListener'
import Comments from './Comments'
import SocketSubscriber from 'components/SocketSubscriber'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import PeopleInfo from 'components/PostCard/PeopleInfo'
import ProjectContributions from './ProjectContributions'
import PostPeopleDialog from 'components/PostPeopleDialog'
import useRouteParams from 'hooks/useRouteParams'
import fetchPost from 'store/actions/fetchPost'
import joinProject from 'store/actions/joinProject'
import leaveProject from 'store/actions/leaveProject'
import processStripeToken from 'store/actions/processStripeToken'
import respondToEvent from 'store/actions/respondToEvent'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import { FETCH_POST, RESP_MANAGE_TRACKS } from 'store/constants'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getPost from 'store/selectors/getPost'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { cn } from 'util/index'
import { removePostFromUrl } from '@hylo/navigation'
import { DETAIL_COLUMN_ID, CENTER_COLUMN_ID, position } from 'util/scrolling'

import ActionCompletionSection from './ActionCompletionSection'

import classes from './PostDetail.module.scss'

// the height of the header plus the padding-top
const STICKY_HEADER_SCROLL_OFFSET = 60
const MAX_DETAILS_LENGTH = 144

function PostDetail () {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useRouteParams()
  const postId = routeParams.postId || getQuerystringParam('fromPostId', location)
  const { groupSlug, view } = routeParams
  const commentId = getQuerystringParam('commentId', location) || routeParams.commentId
  const currentGroup = useSelector(state => getGroupForSlug(state, groupSlug))
  const hasTracksResponsibility = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_TRACKS }))
  const postSelector = useSelector(state => getPost(state, postId))
  const post = useMemo(() => {
    return postSelector ? presentPost(postSelector, get('id', currentGroup)) : null
  }, [postSelector, currentGroup])
  const currentUser = useSelector(getMe)
  const pending = useSelector(state => state.pending[FETCH_POST])

  const [state, setState] = useState({
    atHeader: false,
    headerWidth: 0,
    headerScrollOffset: 0,
    atActivity: false,
    activityWidth: 0,
    activityScrollOffset: 0,
    showPeopleDialog: false
  })

  const activityHeader = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    onPostIdChange()
  }, [postId])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    if (view === 'post') {
      setHeaderDetails({
        title: t('Post'),
        icon: '',
        info: '',
        search: false
      })
    }
  }, [])

  const handleSetComponentPositions = useCallback(() => {
    const container = document.getElementById(DETAIL_COLUMN_ID)
    if (!container) return
    const element = activityHeader.current
    setState(prevState => ({
      ...prevState,
      headerWidth: container.offsetWidth,
      activityWidth: element ? element.offsetWidth : 0,
      activityScrollOffset: element ? position(element, container).y - STICKY_HEADER_SCROLL_OFFSET : 0
    }))
  }, [])

  const { ref } = useResizeDetector({ handleHeight: false, onResize: handleSetComponentPositions })

  const onPostIdChange = useCallback(() => {
    if (!pending) {
      dispatch(fetchPost(postId, hasTracksResponsibility))
    }

    if (post) {
      dispatch(trackAnalyticsEvent(AnalyticsEvents.POST_OPENED, {
        postId: post.id,
        groupId: post.groups.map(g => g.id),
        isPublic: post.isPublic,
        topics: post.topics?.map(t => t.name),
        type: post.type
      }))
    }
  }, [postId, post, pending])

  const handleScroll = throttle(100, event => {
    const { scrollTop } = event.target
    const {
      atHeader,
      atActivity,
      headerScrollOffset,
      activityScrollOffset
    } = state
    setState(prevState => ({
      ...prevState,
      atActivity: !atActivity && scrollTop >= activityScrollOffset ? true : atActivity && scrollTop < activityScrollOffset ? false : atActivity,
      atHeader: !atHeader && scrollTop > headerScrollOffset ? true : atHeader && scrollTop <= headerScrollOffset ? false : atHeader
    }))
  })

  const togglePeopleDialog = useCallback(() => setState(prevState => ({ ...prevState, showPeopleDialog: !prevState.showPeopleDialog })), [])

  const onClose = useCallback(() => {
    const closeLocation = {
      ...location,
      pathname: removePostFromUrl(location.pathname) || '/'
    }
    navigate(closeLocation)
  }, [location])

  // Pull-to-close: drag the dialog/container down to dismiss when scrolled to top
  const pullTouchRef = useRef(null)
  const touchStartY = useRef(null)
  const touchStartScrollTop = useRef(null)
  const isDraggingDown = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const PULL_THRESHOLD = 100

  useEffect(() => {
    const el = pullTouchRef.current
    if (!el) return

    // The drag target is the dialog content wrapper (or the detail column if not in a dialog)
    const getDragTarget = () =>
      document.getElementById('post-dialog-content') || document.getElementById(DETAIL_COLUMN_ID)

    // The scroll container is the dialog overlay (has overflow-y: auto) or the detail column
    const getScrollContainer = () => {
      const dialog = document.getElementById('post-dialog-content')
      if (dialog) {
        // The overlay is the dialog content's parent
        return dialog.closest('.PostDialog-Overlay') || dialog.parentElement
      }
      return document.getElementById(DETAIL_COLUMN_ID) || document.getElementById(CENTER_COLUMN_ID)
    }

    const dragTarget = getDragTarget()
    const scrollContainer = getScrollContainer()
    // Attach listeners to the scroll container so we can intercept before native scroll
    const listenTarget = scrollContainer || el

    // The overlay is the scroll container when inside a dialog
    const overlay = scrollContainer?.classList?.contains('PostDialog-Overlay') ? scrollContainer : null

    const resetStyles = () => {
      if (dragTarget) {
        dragTarget.style.transform = ''
        dragTarget.style.opacity = ''
        dragTarget.style.borderRadius = ''
        dragTarget.style.willChange = ''
      }
      if (overlay) {
        overlay.style.backgroundColor = ''
        overlay.style.backdropFilter = ''
      }
    }

    const handleTouchStart = (e) => {
      if (!scrollContainer) return
      touchStartY.current = e.touches[0].clientY
      touchStartScrollTop.current = scrollContainer.scrollTop
      isDraggingDown.current = false
      if (dragTarget) {
        dragTarget.style.transition = 'none'
      }
    }

    const handleTouchMove = (e) => {
      if (touchStartY.current === null || touchStartScrollTop.current === null) return
      if (touchStartScrollTop.current > 0) return
      if (!scrollContainer || !dragTarget) return

      const currentY = e.touches[0].clientY
      const rawDelta = currentY - touchStartY.current

      if (rawDelta > 0 && scrollContainer.scrollTop <= 0) {
        e.preventDefault()

        isDraggingDown.current = true
        const dampened = rawDelta * 0.45
        const progress = Math.min(dampened / PULL_THRESHOLD, 1.5)
        const opacity = Math.max(1 - progress * 0.4, 0.3)
        const scale = Math.max(1 - progress * 0.04, 0.92)

        dragTarget.style.transform = `translateY(${dampened}px) scale(${scale})`
        dragTarget.style.opacity = opacity
        dragTarget.style.borderRadius = `${Math.min(progress * 16, 16)}px`
        dragTarget.style.transformOrigin = 'top center'
        dragTarget.style.willChange = 'transform, opacity'

        // Fade the overlay background as the card is dragged
        if (overlay) {
          const overlayOpacity = Math.max(1 - progress * 0.6, 0.1)
          overlay.style.backgroundColor = `rgba(0, 0, 0, ${overlayOpacity * 0.5})`
          overlay.style.backdropFilter = `blur(${Math.max(12 - progress * 8, 0)}px)`
        }
      } else if (isDraggingDown.current) {
        isDraggingDown.current = false
        resetStyles()
      }
    }

    const handleTouchEnd = (e) => {
      if (touchStartY.current === null || touchStartScrollTop.current === null) return

      if (!isDraggingDown.current || touchStartScrollTop.current > 0) {
        touchStartY.current = null
        touchStartScrollTop.current = null
        isDraggingDown.current = false
        return
      }

      const touchEndY = e.changedTouches[0].clientY
      const rawDelta = touchEndY - touchStartY.current
      const dampened = rawDelta * 0.45

      if (dampened >= PULL_THRESHOLD && dragTarget) {
        dragTarget.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out'
        dragTarget.style.transform = 'translateY(60vh) scale(0.9)'
        dragTarget.style.opacity = '0'
        if (overlay) {
          overlay.style.transition = 'background-color 0.25s ease-out, backdrop-filter 0.25s ease-out'
          overlay.style.backgroundColor = 'transparent'
          overlay.style.backdropFilter = 'blur(0px)'
        }
        setTimeout(() => onCloseRef.current(), 200)
      } else {
        if (dragTarget) {
          dragTarget.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.3s ease, border-radius 0.3s ease'
        }
        if (overlay) {
          overlay.style.transition = 'background-color 0.3s ease, backdrop-filter 0.3s ease'
        }
        resetStyles()
      }

      touchStartY.current = null
      touchStartScrollTop.current = null
      isDraggingDown.current = false
    }

    listenTarget.addEventListener('touchstart', handleTouchStart, { passive: true })
    listenTarget.addEventListener('touchmove', handleTouchMove, { passive: false })
    listenTarget.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      listenTarget.removeEventListener('touchstart', handleTouchStart)
      listenTarget.removeEventListener('touchmove', handleTouchMove)
      listenTarget.removeEventListener('touchend', handleTouchEnd)
      resetStyles()
      if (dragTarget) {
        dragTarget.style.transition = ''
      }
      if (overlay) {
        overlay.style.transition = ''
      }
    }
  // Re-run when post loads (ref won't be set until post renders the JSX)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, !!post])

  const scrollToBottom = useCallback(() => {
    const detail = document.getElementById(DETAIL_COLUMN_ID)
    detail.scrollTop = detail.scrollHeight
  }, [])

  const isProject = useMemo(() => get('type', post) === 'project', [post])
  const isProjectMember = useMemo(() => isProject && find(({ id }) => id === get('id', currentUser), get('members', post)), [currentUser, post])
  const isEvent = useMemo(() => get('type', post) === 'event', [post])

  // TODO: if not in a group should show as flagged if flagged in any of my groups
  const isFlagged = useMemo(() => post?.flaggedGroups && post.flaggedGroups.includes(currentGroup?.id), [post, currentGroup])

  const projectManagementTool = useMemo(() => {
    const m = post?.projectManagementLink ? post.projectManagementLink.match(/(asana|trello|airtable|clickup|confluence|teamwork|notion|wrike|zoho)/) : null
    return m ? m[1] : null
  }, [post?.projectManagementLink])

  const d = post?.donationsLink ? post.donationsLink.match(/(cash|clover|gofundme|opencollective|paypal|squareup|venmo)/) : null
  const donationService = d ? d[1] : null

  const { acceptContributions, totalContributions } = post || {}

  let people, postPeopleDialogTitle

  if (isProject) {
    people = post?.members
    postPeopleDialogTitle = t('Project Members')
  } else if (isEvent) {
    people = post?.eventInvitations
    postPeopleDialogTitle = t('Responses')
  }

  const hasImage = useMemo(() => post?.attachments.find(a => a.type === 'image') || false, [post])
  const hasPeople = useMemo(() => people && people.length > 0, [people])
  const showPeopleDialog = hasPeople && state.showPeopleDialog
  const handleTogglePeopleDialog = hasPeople && togglePeopleDialog ? togglePeopleDialog : undefined

  if (!post && !pending) return <NotFound />
  if (!post && pending) return <Loading />

  const headerStyle = {
    width: state.headerWidth + 'px'
  }
  const activityStyle = {
    width: state.activityWidth + 'px',
    marginTop: STICKY_HEADER_SCROLL_OFFSET + 'px'
  }

  return (
    <div
      ref={(node) => {
        ref(node)
        pullTouchRef.current = node
      }}
      id={`post-detail-container-${post.id}`}
      className={cn('PostDetail max-w-[960px] mx-auto min-w-[290px] sm:min-w-[350px] relative', { [classes.noUser]: !currentUser, [classes.headerPad]: state.atHeader })}
    >
      <Helmet>
        <title>
          {`${post.title || TextHelpers.presentHTMLToText(post.details, { truncate: 20 })} | Hylo`}
        </title>
        <meta name='description' content={TextHelpers.presentHTMLToText(post.details, { truncate: MAX_DETAILS_LENGTH })} />
      </Helmet>
      <div className='flex flex-col rounded-lg shadow-sm'>
        <ScrollListener elementId={DETAIL_COLUMN_ID} onScroll={handleScroll} />
        <PostHeader
          className={classes.header}
          post={post}
          routeParams={routeParams}
          close={onClose}
          expanded
          isFlagged={isFlagged}
          hasImage={hasImage}
        />
        <PostGroups
          isPublic={post.isPublic}
          groups={post.groups}
          slug={groupSlug}
          showBottomBorder
        />
        {state.atHeader && (
          <div className={cn(classes.headerSticky, { [classes.atActivity]: state.atActivity })} style={headerStyle}>
            <PostHeader
              className={classes.header}
              currentUser={currentUser}
              post={post}
              routeParams={routeParams}
              close={onClose}
              isFlagged={isFlagged}
            />
          </div>
        )}
        <div className='bg-card rounded-lg shadow-md'>
          {post.attachments && post.attachments.length > 0 && (
            <CardImageAttachments attachments={post.attachments} isFlagged={isFlagged && !post.clickthrough} />
          )}
          {isEvent && (
            <EventBody
              className={classes.body}
              expanded
              currentUser={currentUser}
              slug={groupSlug}
              event={post}
              respondToEvent={(response) => dispatch(respondToEvent(post, response))}
              togglePeopleDialog={handleTogglePeopleDialog}
              isFlagged={isFlagged}
            />
          )}
          {!isEvent && (
            <PostBody
              currentUser={currentUser}
              className={classes.body}
              expanded
              routeParams={routeParams}
              slug={groupSlug}
              isFlagged={isFlagged}
              {...post}
            />
          )}
          {isProject && currentUser && (
            <div className='flex flex-col gap-2 p-2 sm:p-4'>
              <div className={classes.joinProjectButtonContainer}>
                <JoinProjectSection
                  currentUser={currentUser}
                  joinProject={() => dispatch(joinProject(postId))}
                  leaveProject={() => dispatch(leaveProject(postId))}
                  leaving={isProjectMember}
                  members={post.members}
                  togglePeopleDialog={handleTogglePeopleDialog}
                />
              </div>
              {post.projectManagementLink && projectManagementTool && (
                <div className='border-2 border-foreground/20 rounded-lg p-2 flex flex-row gap-2 w-full justify-between border-dashed items-center'>
                  <div>{t('This project is being managed on')} <img className='max-h-4 m-0' src={`/assets/pm-tools/${projectManagementTool}.svg`} /></div>
                  <div><a className='inline-block border-2 border-selected/20 rounded-lg p-2 px-4 hover:border-selected/100 transition-all text-selected' href={post.projectManagementLink} target='_blank' rel='noreferrer'>{t('View tasks')}</a></div>
                </div>
              )}
              {post.projectManagementLink && !projectManagementTool && (
                <div className='border-2 border-foreground/20 rounded-lg p-2 flex flex-row gap-2 w-full justify-between border-dashed items-center'>
                  <div>{t('View project management tool')}</div>
                  <div><a className='inline-block border-2 border-selected/20 rounded-lg p-2 px-4 hover:border-selected/100 transition-all text-selected' href={post.projectManagementLink} target='_blank' rel='noreferrer'>{t('View tasks')}</a></div>
                </div>
              )}
              {post.donationsLink && donationService && (
                <div className='border-2 border-foreground/20 rounded-lg p-2 flex flex-row gap-2 w-full justify-between border-dashed items-center'>
                  <div className='flex items-center gap-2'>{t('Support this project on')} <img className='max-h-4 m-0' src={`/assets/payment-services/${donationService}.svg`} /></div>
                  <div><a className='inline-block border-2 border-selected/20 rounded-lg p-2 px-4 hover:border-selected/100 transition-all text-selected' href={post.donationsLink} target='_blank' rel='noreferrer'>{t('Contribute')}</a></div>
                </div>
              )}
              {post.donationsLink && !donationService && (
                <div className='border-2 border-foreground/20 rounded-lg p-2 flex flex-row gap-2 w-full justify-between border-dashed'>
                  <div>{t('Support this project')}</div>
                  <div><a className='inline-block border-2 border-selected/20 rounded-lg p-2 px-4 hover:border-selected/100 transition-all text-selected' href={post.donationsLink} target='_blank' rel='noreferrer'>{t('Contribute')}</a></div>
                </div>
              )}
            </div>
          )}
          {isProject && acceptContributions && currentUser.hasFeature(PROJECT_CONTRIBUTIONS) && (
            <ProjectContributions
              postId={post.id}
              totalContributions={totalContributions}
              processStripeToken={(token, amount) => dispatch(processStripeToken(postId, token, amount))}
            />
          )}
          {post.type === 'action' && post.completionAction && (
            <ActionCompletionSection
              post={post}
              currentUser={currentUser}
            />
          )}
          <PostFooter {...post} currentUser={currentUser} />
        </div>
        <div ref={activityHeader} />
        {state.atActivity && (
          <div className={classes.activitySticky} style={activityStyle}>
            <PostFooter {...post} currentUser={currentUser} />
          </div>
        )}
      </div>
      {post.type === 'action' && hasTracksResponsibility && (
        <ActionCompletionsSection
          post={post}
          currentUser={currentUser}
        />
      )}
      <Comments
        post={post}
        slug={groupSlug}
        selectedCommentId={commentId}
        scrollToBottom={scrollToBottom}
      />
      {showPeopleDialog && (
        <PostPeopleDialog
          currentGroup={currentGroup}
          title={postPeopleDialogTitle}
          members={people}
          onClose={handleTogglePeopleDialog}
          slug={groupSlug}
        />
      )}
      <SocketSubscriber type='post' id={post.id} />
    </div>
  )
}

PostDetail.propTypes = {
  currentUser: PropTypes.object,
  fetchPost: PropTypes.func,
  post: PropTypes.object,
  routeParams: PropTypes.object
}

export function JoinProjectSection ({ currentUser, members, leaving, joinProject, leaveProject, togglePeopleDialog }) {
  const { t } = useTranslation()
  const buttonText = leaving ? t('Leave Project') : t('Join Project')
  const onClick = () => leaving ? leaveProject() : joinProject()

  return (
    <div className='flex flex-row gap-2 items-center border-2 border-foreground/20 rounded-lg p-2 w-full justify-between border-dashed'>
      <PeopleInfo
        people={members}
        peopleTotal={members.length}
        excludePersonId={get('id', currentUser)}
        onClick={togglePeopleDialog}
        phrases={{
          emptyMessage: t('No project members'),
          phraseSingular: t('is a member'),
          mePhraseSingular: t('are a member'),
          pluralPhrase: t('are members')
        }}
      />
      <Button
        key='join-project-button'
        onClick={onClick}
        variant='outline'
      >
        {buttonText}
      </Button>
    </div>
  )
}

export function ActionCompletionsSection ({ currentUser, post }) {
  const { t } = useTranslation()

  const [showCompletionResponsesDialog, setShowCompletionResponsesDialog] = useState(false)
  const toggleCompletionResponsesDialog = () => setShowCompletionResponsesDialog(!showCompletionResponsesDialog)

  const completers = post.completionResponses.map(response => response.user)

  return (
    <div className='border-border border-2 rounded-lg p-4 flex flex-row gap-2 mt-4 w-full justify-between'>
      <PeopleInfo
        people={completers}
        peopleTotal={completers.length}
        onClick={toggleCompletionResponsesDialog}
        excludePersonId={currentUser.id}
        phrases={{
          emptyMessage: t('No one has completed this action yet'),
          phraseSingular: t('has completed this action'),
          mePhraseSingular: t('have completed this action'),
          pluralPhrase: t('have completed this action')
        }}
      />
      {post.completionResponses.length > 0 && (
        <Button
          onClick={toggleCompletionResponsesDialog}
          className='border-2 border-foreground/20 hover:border-foreground/50 transition-all px-4 py-2 rounded-md bg-transparent'
        >
          {t('View All Responses')}
        </Button>
      )}
      {showCompletionResponsesDialog && (
        <ActionCompletionResponsesDialog
          portalTarget='post-dialog-content'
          post={post}
          onClose={toggleCompletionResponsesDialog}
        />
      )}
    </div>
  )
}

export default PostDetail
