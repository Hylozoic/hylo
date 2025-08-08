import { DndContext, closestCorners } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { isEmpty } from 'lodash/fp'
import { Shapes, Settings, DoorOpen, Check, Eye, ChevronsRight } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { useLocation, useNavigate, Routes, Route, Link } from 'react-router-dom'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'

import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import Button from 'components/ui/button'
import * as Dialog from '@radix-ui/react-dialog'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import { enrollInTrack, fetchTrack, FETCH_TRACK, leaveTrack, updateTrackActionOrder, updateTrack } from 'store/actions/trackActions'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getTrack from 'store/selectors/getTrack'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { bgImageStyle, cn } from 'util/index'
import { createPostUrl, groupUrl, personUrl } from '@hylo/navigation'

import ActionSummary from './ActionSummary'

const getPosts = ormCreateSelector(
  orm,
  (session, currentTrack) => currentTrack.posts,
  (session, posts) => {
    if (isEmpty(posts)) return []
    // Get all posts in the order specified
    return posts
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(p => presentPost(p))
  }
)

function TrackHome () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const location = useLocation()
  const queryParams = useMemo(() => getQuerystringParam(['tab'], location), [location])
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const currentTrack = useSelector(state => getTrack(state, routeParams.trackId))
  const isLoading = useSelector(state => isPendingFor(state, FETCH_TRACK))
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const [container, setContainer] = useState(null)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const [currentTab, setCurrentTab] = useState(queryParams.tab || 'about')

  const changeTab = useCallback((tab) => {
    setCurrentTab(tab)
    dispatch(changeQuerystringParam(location, 'tab', tab, null, true))
  }, [location])

  useEffect(() => {
    dispatch(fetchTrack(routeParams.trackId))
  }, [routeParams.trackId])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: currentTrack?.name || t('loading...'),
      search: true,
      icon: <Shapes />
    })
  }, [currentTrack])

  const handlePublishTrack = useCallback((publishedAt) => {
    if (confirm(publishedAt ? t('Are you sure you want to publish this track?') : t('Are you sure you want to unpublish this track?'))) {
      dispatch(updateTrack({ trackId: currentTrack.id, publishedAt }))
    }
  }, [currentTrack?.id])

  const handleEnrollInTrack = useCallback(() => {
    dispatch(enrollInTrack(currentTrack.id))
    if (currentTrack?.welcomeMessage) {
      setShowWelcomeMessage(true)
    }
  }, [currentTrack?.id, currentTrack?.welcomeMessage])

  if (isLoading) return <Loading />
  if (!currentTrack) return <Loading />

  const { didComplete, isEnrolled, publishedAt } = currentTrack

  if (!canEdit && !publishedAt) {
    return <NotFound />
  }

  return (
    <div className='w-full h-full' ref={setContainer}>
      <div className='pt-4 px-4 w-full h-full relative overflow-y-auto flex flex-col'>
        <div className='w-full max-w-[750px] mx-auto flex-1'>
          {(isEnrolled || canEdit) && (
            <div className='flex gap-2 w-full justify-center items-center bg-black/20 rounded-md p-2'>
              <button
                className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'about' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                onClick={() => changeTab('about')}
              >
                {t('About')}
              </button>
              <button
                className={`py-1 px-4  rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'actions' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                onClick={() => changeTab('actions')}
              >
                {currentTrack.actionDescriptorPlural}
                <span className='ml-2 bg-black/20 text-xs font-bold px-2 py-0.5 rounded-full'>
                  {currentTrack.numActions}
                </span>
              </button>
              <button
                className={`py-1 px-4  rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'people' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                onClick={() => changeTab('people')}
              >
                {t('People')}
                {currentTrack.enrolledUsers?.length > 0 && (
                  <span className='ml-2 bg-black/20 text-xs font-bold px-2 py-0.5 rounded-full'>
                    {currentTrack.enrolledUsers.length}
                  </span>
                )}
              </button>
              {canEdit && (
                <button
                  className={`py-1 px-4 rounded-md border-2 border-foreground/20 hover:border-foreground/100 transition-all ${currentTab === 'edit' ? 'bg-selected border-selected hover:border-selected/100 shadow-md hover:scale-105' : 'bg-transparent'}`}
                  onClick={() => changeTab('edit')}
                >
                  {t('Edit')}
                </button>
              )}
            </div>
          )}

          {currentTab === 'about' && (
            <AboutTab currentTrack={currentTrack} />
          )}

          {currentTab === 'actions' && (
            <ActionsTab currentTrack={currentTrack} />
          )}

          {currentTab === 'people' && (
            <PeopleTab currentTrack={currentTrack} />
          )}

          {canEdit && currentTab === 'edit' && (
            <EditTab currentTrack={currentTrack} />
          )}
        </div>

        <div className='flex flex-row gap-2 mx-auto w-full max-w-[750px] px-4 py-2 items-center bg-input rounded-t-md'>
          {!publishedAt
            ? (
              <>
                <span className='flex-1'>{t('This track is not yet published')}</span>
                <Button
                  variant='secondary'
                  onClick={(e) => handlePublishTrack(new Date().toISOString())}
                >
                  <Eye className='w-5 h-5 inline-block' /> <span className='inline-block'>{t('Publish')}</span>
                </Button>
              </>
              )
            : didComplete
              ? (
                <>
                  <Check className='w-4 h-4 text-selected' />
                  <span>{t('You completed this track')}</span>
                </>
                )
              : isEnrolled
                ? (
                  <>
                    <div className='flex flex-row gap-2 items-center justify-between w-full'>
                      <span className='flex flex-row gap-2 items-center'><Check className='w-4 h-4 text-selected' /> {t('You are currently enrolled in this track')}</span>
                      <button className='border-2 border-foreground/20 flex flex-row gap-2 items-center rounded-md p-2 px-4 ' onClick={() => dispatch(leaveTrack(currentTrack.id))}><DoorOpen className='w-4 h-4' />{t('Leave Track')}</button>
                    </div>
                  </>
                  )
                : (
                  <div className='flex flex-row gap-2 items-center justify-between w-full'>
                    <span>{t('Ready to jump in?')}</span>
                    <button className='bg-selected text-foreground rounded-md p-2 px-4 flex flex-row gap-2 items-center' onClick={handleEnrollInTrack}><ChevronsRight className='w-4 h-4' /> {t('Enroll')}</button>
                  </div>
                  )}
        </div>

        <WelcomeMessage currentTrack={currentTrack} showWelcomeMessage={showWelcomeMessage} setShowWelcomeMessage={setShowWelcomeMessage} />

        <Routes>
          <Route path='post/:postId' element={<PostDialog container={container} />} />
        </Routes>
      </div>
    </div>
  )
}

function AboutTab ({ currentTrack }) {
  const { bannerUrl, name, description } = currentTrack

  return (
    <>
      <div
        className='mt-4 w-full shadow-2xl max-w-[750px] rounded-xl h-[40vh] flex flex-col items-center justify-end bg-cover mb-6 pb-6 relative overflow-hidden'
        style={bannerUrl ? bgImageStyle(bannerUrl) : {}}
      >
        <div className='absolute inset-0 bg-black/40 z-10' />
        <h1 className='text-white text-4xl font-bold z-20'>{name}</h1>
      </div>
      <HyloHTML html={description} />
    </>
  )
}

function ActionsTab ({ currentTrack }) {
  const posts = useSelector(state => getPosts(state, currentTrack))
  const { isEnrolled } = currentTrack

  return (
    <div className={cn({ 'pointer-events-none opacity-50': !isEnrolled })}>
      <h1>{currentTrack.actionDescriptorPlural}</h1>
      {posts.map(post => (
        <PostCard key={post.id} post={post} isCurrentAction={currentTrack.currentAction?.id === post.id} />
      ))}
    </div>
  )
}

function PeopleTab ({ currentTrack }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const { enrolledUsers } = currentTrack

  return (
    <div>
      {enrolledUsers?.length === 0 && <h1>{t('No one is enrolled in this track')}</h1>}
      {enrolledUsers?.length > 0 && (
        <div className='flex flex-col gap-2 pt-4'>
          {enrolledUsers?.map(user => (
            <div key={user.id} className='flex flex-row gap-2 items-center justify-between'>
              <div>
                <Link to={personUrl(user.id, routeParams.groupSlug)} className='flex flex-row gap-2 items-center text-foreground'>
                  <img src={user.avatarUrl} alt={user.name} className='w-10 h-10 rounded-full my-2' />
                  <span>{user.name}</span>
                </Link>
              </div>
              <div className='flex flex-row gap-4 items-center text-xs text-foreground/60'>
                <div>
                  <span>{t('Enrolled {{date}}', { date: DateTimeHelpers.formatDatePair(user.enrolledAt) })}</span>
                </div>
                <div>
                  <span>{user.completedAt ? t('Completed {{date}}', { date: DateTimeHelpers.formatDatePair(user.completedAt) }) : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditTab ({ currentTrack }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const posts = useSelector(state => getPosts(state, currentTrack))

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && over.id !== active.id) {
      const overIndex = over.data.current.sortable.index
      dispatch(updateTrackActionOrder({
        postId: active.id,
        trackId: currentTrack.id,
        newOrderIndex: overIndex
      }))
    }
  }

  return (
    <>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center mt-4 mb-4'
        onClick={() => navigate(groupUrl(routeParams.groupSlug, `tracks/${currentTrack.id}/edit`))}
      >
        <Settings className='w-4 h-4' />
        <span>{t('Open Track Settings')}</span>
      </button>
      <DndContext
        onDragEnd={handleDragEnd}
        collisionDetection={closestCorners}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={posts.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {posts.map(post => (
            <ActionSummary key={post.id} post={post} />
          ))}
        </SortableContext>
      </DndContext>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md mb-4'
        onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'action' }))}
      >
        + {t('Add {{actionDescriptor}}', { actionDescriptor: currentTrack?.actionDescriptor })}
      </button>
    </>
  )
}

function WelcomeMessage ({ showWelcomeMessage, setShowWelcomeMessage, currentTrack }) {
  const { welcomeMessage } = currentTrack

  return (
    <Dialog.Root open={showWelcomeMessage} onOpenChange={setShowWelcomeMessage}>
      <Dialog.Portal>
        <Dialog.Overlay className='CompletedTrackDialog-Overlay bg-black/50 absolute top-0 left-0 right-0 bottom-0 grid place-items-center overflow-y-auto z-[900] backdrop-blur-sm'>
          <Dialog.Content className='CompletedTrackDialog-Content min-w-[300px] w-full bg-background p-4 rounded-md z-[51] max-w-[750px] outline-none'>
            <Dialog.Title className='sr-only'>Welcome to {currentTrack?.name}!</Dialog.Title>
            <Dialog.Description className='sr-only'>Welcome to {currentTrack?.name}!</Dialog.Description>
            <h3 className='text-2xl font-bold text-center'>👋 Welcome to {currentTrack?.name}!</h3>
            {welcomeMessage && (
              <ClickCatcher>
                <HyloHTML element='p' html={TextHelpers.markdown(welcomeMessage)} className='text-center text-foreground/70' />
              </ClickCatcher>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default TrackHome
