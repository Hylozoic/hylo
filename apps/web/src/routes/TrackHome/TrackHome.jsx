import { isEmpty } from 'lodash/fp'
import { Shapes, Settings, DoorOpen, Check } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { useNavigate, Routes, Route } from 'react-router-dom'
import HyloHTML from 'components/HyloHTML'
import Loading from 'components/Loading'
import NotFound from 'components/NotFound'
import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import { enrollInTrack, fetchTrack, FETCH_TRACK, leaveTrack } from 'store/actions/trackActions'
import { RESP_MANAGE_TRACKS } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getTrack from 'store/selectors/getTrack'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import isPendingFor from 'store/selectors/isPendingFor'
import { bgImageStyle } from 'util/index'
import { createPostUrl, groupUrl } from 'util/navigation'

const getPosts = ormCreateSelector(
  orm,
  (session, currentTrack) => currentTrack.posts,
  (session, posts) => {
    if (isEmpty(posts)) return []
    return posts
      .sort((a, b) => a.order - b.order)
      .map(p => presentPost(p))
  }
)

function TrackHome () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const queryParams = useMemo(() => getQuerystringParam(['tab'], location), [location])
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const currentTrack = useSelector(state => getTrack(state, routeParams.trackId))
  const isLoading = useSelector(state => isPendingFor(state, FETCH_TRACK))
  const canEdit = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: currentGroup?.id }))
  const [container, setContainer] = React.useState(null)

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
      title: t('Track: {{trackName}}', { trackName: currentTrack?.name || 'loading...' }),
      search: true,
      icon: <Shapes />
    })
  }, [currentTrack])

  if (isLoading) return <Loading />
  if (!currentTrack) return <Loading />

  const { isEnrolled } = currentTrack

  return (
    <div className='p-4 max-w-[750px] mx-auto' ref={setContainer}>
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
            {currentTrack.actionsName}
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

      {currentTab === 'edit' && (
        <EditTab currentTrack={currentTrack} />
      )}

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>
    </div>
  )
}

function AboutTab ({ currentTrack }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { bannerUrl, name, description, isEnrolled } = currentTrack

  return (
    <>
      <div
        className='mt-4 w-full shadow-2xl max-w-[750px] rounded-xl h-[40vh] flex flex-col items-center justify-center bg-cover'
        style={bannerUrl ? bgImageStyle(bannerUrl) : {}}
      >
        <h1 className='text-white text-4xl font-bold'>{name}</h1>
      </div>
      <HyloHTML html={description} />

      {!isEnrolled
        ? (
          <div className='flex flex-row gap-2 fixed bottom-0 mx-auto w-full max-w-[750px] px-4 py-2 justify-between items-center bg-input rounded-t-md'>
            <span>{t('Ready to jump in?')}</span>
            <button className='bg-selected text-foreground rounded-md p-2 px-4' onClick={() => dispatch(enrollInTrack(currentTrack.id))}>{t('Enroll')}</button>
          </div>
          )
        : (
          <div className='flex flex-row gap-2 border-2 border-foreground/20 border-dashed rounded-md p-2 justify-between items-center'>
            <span className='flex flex-row gap-2 items-center'><Check className='w-4 h-4 text-selected' /> {t('You are currently enrolled in this track')}</span>
            <button className='border-2 border-foreground/20 flex flex-row gap-2 items-center rounded-md p-2 px-4' onClick={() => dispatch(leaveTrack(currentTrack.id))}><DoorOpen className='w-4 h-4' />{t('Leave Track')}</button>
          </div>
          )}
    </>
  )
}

function ActionsTab ({ currentTrack }) {
  const posts = useSelector(state => getPosts(state, currentTrack))

  return (
    <>
      <h1>{currentTrack.actionsName}</h1>
      {posts.map(post => (
        <PostCard key={post.id} post={post} isCurrentAction={currentTrack.currentAction?.id === post.id} />
      ))}
    </>
  )
}

function EditTab ({ currentTrack }) {
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const navigate = useNavigate()
  const posts = useSelector(state => getPosts(state, currentTrack))

  return (
    <>
      <button
        className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center mt-4 mb-4'
        onClick={() => navigate(groupUrl(routeParams.groupSlug, `tracks/${currentTrack.id}/edit`))}
      >
        <Settings className='w-4 h-4' />
        <span>{t('Open Track Settings', { actionName: currentTrack.actionsName.slice(0, -1) })}</span>
      </button>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      <button className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/100 transition-all px-4 py-2 rounded-md' onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'action' }))}>+ {t('Add {{actionName}}', { actionName: currentTrack.actionsName.slice(0, -1) })}</button>
    </>
  )
}

export default TrackHome
