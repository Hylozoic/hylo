import { isEmpty } from 'lodash/fp'
import { Shapes } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { useNavigate, Routes, Route } from 'react-router-dom'
import Button from 'components/ui/button'
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
import { createPostUrl } from 'util/navigation'

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
  if (!currentTrack) return <NotFound />

  const { isEnrolled } = currentTrack

  return (
    <div className='p-4' ref={setContainer}>
      {(isEnrolled || canEdit) && (
        <div>
          <Button variant={currentTab === 'about' ? 'secondary' : 'primary'} onClick={() => changeTab('about')}>{t('About')}</Button>
          <Button variant={currentTab === 'actions' ? 'secondary' : 'primary'} onClick={() => changeTab('actions')}>{t('Actions')}</Button>
          {canEdit && (
            <Button variant={currentTab === 'edit' ? 'secondary' : 'primary'} onClick={() => changeTab('edit')}>{t('Edit')}</Button>
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
  const { name, description, isEnrolled } = currentTrack

  return (
    <>
      <h1>{name}</h1>
      <HyloHTML html={description} />

      {!isEnrolled
        ? (
          <div>
            <Button variant='secondary' onClick={() => dispatch(enrollInTrack(currentTrack.id))}>{t('Enroll')}</Button>
          </div>
          )
        : (
          <div>
            <Button variant='secondary' onClick={() => dispatch(leaveTrack(currentTrack.id))}>{t('Leave Track')}</Button>
          </div>
          )}
    </>
  )
}

function ActionsTab ({ currentTrack }) {
  const { t } = useTranslation()
  const posts = useSelector(state => getPosts(state, currentTrack))

  return (
    <>
      <h1>{t('Actions')}</h1>
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
      <h1>{t('Edit')}</h1>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      <Button variant='secondary' onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'action' }))}>+ {t('Add Action')}</Button>
    </>
  )
}

export default TrackHome
