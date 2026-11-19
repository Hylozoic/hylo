import { isEmpty } from 'lodash/fp'
import { Pencil, Shapes } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Loading from 'components/Loading'
import PostDialog from 'components/PostDialog'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useViewPostDetails from 'hooks/useViewPostDetails'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { fetchViewPosts } from 'store/actions/groupViews'
import { enrollInTrack } from 'store/actions/trackActions'
import { RESP_ADMINISTRATION } from 'store/constants'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { addQuerystringToPath } from '@hylo/navigation'
import { cn } from 'util/index'

import TrackOutline from './TrackOutline'
import TrackOutlineEditor from './TrackOutlineEditor'
import { buildOutline } from './outlineModel'

/**
 * A Track space's outline: actions on their own or grouped into modules.
 * Participants see their progress and what's up next; space managers can switch
 * to the outline editor to add, rename and reorder modules and actions.
 */
export default function TrackActionsView () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const viewPostDetails = useViewPostDetails()
  const groupSlug = useEffectiveGroupSlug()
  const { parentGroupSlug } = useGroupRouteOpts()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => parentGroupSlug ? getGroupForSlug(state, parentGroupSlug) : null)
  // group.track is populated (with the fields this view needs) as soon as the
  // space's Group is loaded — see store/util/extractNestedGroups.js — so there's
  // no need for a separate Track fetch/selector here.
  const currentTrack = group?.track
  const trackId = currentTrack?.id
  // Roles live on the parent group; prefer parentId / route parent so edit works
  // even before the space record has parentId hydrated in ORM.
  const roleGroupId = group?.parentId || parentGroup?.id || group?.id
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: roleGroupId }))
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister

  // Posts live on the "track-actions" view's ordered collectionPosts.
  const groupViews = useSelector(state => getGroupViews(state, group))
  const view = groupViews.find(v => v.type === 'track-actions')
  const viewId = view?.id
  const collectionPosts = view?.collectionPosts
  const postsMissing = collectionPosts === undefined
  const posts = useMemo(() => {
    if (collectionPosts === undefined) return null
    if (isEmpty(collectionPosts)) return []
    return collectionPosts.map(p => presentPost(p))
  }, [collectionPosts])
  const cachedPostsRef = useRef([])
  if (posts !== null) cachedPostsRef.current = posts
  const displayedPosts = posts !== null ? posts : cachedPostsRef.current
  const trackModules = view?.trackModules
  const outline = useMemo(() => buildOutline(displayedPosts, trackModules), [displayedPosts, trackModules])
  // Hides "Start this track" right away; the track's isEnrolled catches up on the next load
  const [justEnrolled, setJustEnrolled] = useState(false)

  const groupViewsLoaded = group?.groupViews != null

  useEffect(() => {
    if (group?.id && !groupViewsLoaded) {
      dispatch(fetchGroupViews(group.id))
    }
  }, [dispatch, group?.id, groupViewsLoaded])

  // Refresh in place: keep showing the current list while posts fetch.
  useEffect(() => {
    if (!group?.id || !viewId) return
    dispatch(fetchViewPosts(group.id, viewId))
  }, [dispatch, group?.id, viewId])

  useEffect(() => {
    if (!group?.id || !viewId || !postsMissing) return
    dispatch(fetchViewPosts(group.id, viewId))
  }, [dispatch, group?.id, viewId, postsMissing])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: currentTrack?.actionDescriptorPlural || t('Actions'),
      search: false,
      icon: <Shapes />
    })
  }, [currentTrack?.actionDescriptorPlural, t])

  const setEditing = editing => {
    navigate(addQuerystringToPath(location.pathname, { edit: editing ? 'true' : null }), { replace: true })
  }

  const handleEnroll = () => {
    setJustEnrolled(true)
    dispatch(enrollInTrack(trackId))
  }

  if (!group || !groupViewsLoaded || !trackId) return <Loading />

  const { accessControlled, canAccess } = currentTrack
  // Tracks made before modules existed, or loaded by an older query, have no module names
  const track = {
    ...currentTrack,
    actionDescriptor: currentTrack.actionDescriptor || t('Action'),
    actionDescriptorPlural: currentTrack.actionDescriptorPlural || t('Actions'),
    moduleDescriptor: currentTrack.moduleDescriptor || t('Module'),
    moduleDescriptorPlural: currentTrack.moduleDescriptorPlural || t('Modules'),
    isEnrolled: justEnrolled ? true : currentTrack.isEnrolled
  }
  const hasAccess = accessControlled ? canAccess !== false : true

  return (
    <div className='w-full max-w-[750px] mx-auto pb-20 px-4 pt-4'>
      {/* Use PostDialog default portal (#center-column-container) so the modal centers in the scroll viewport */}
      <Routes>
        <Route path='post/:postId' element={<PostDialog />} />
      </Routes>
      {canAdminister && (
        <button
          type='button'
          onClick={() => setEditing(!isEditing)}
          className='w-full text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center mb-4'
        >
          <Pencil className='w-4 h-4' />
          <span>
            {isEditing
              ? t('Done Editing')
              : t('Edit {{moduleDescriptorPlural}} and {{actionDescriptorPlural}}', {
                moduleDescriptorPlural: track.moduleDescriptorPlural,
                actionDescriptorPlural: track.actionDescriptorPlural
              })}
          </span>
        </button>
      )}

      {!hasAccess && (
        <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 text-center my-4'>
          <p className='text-foreground/70'>{t('You need to be granted access to view the actions in this track.')}</p>
        </div>
      )}

      <div className={cn({ 'pointer-events-none opacity-50': !hasAccess })}>
        {postsMissing && displayedPosts.length === 0
          ? <Loading />
          : isEditing
            ? <TrackOutlineEditor items={outline} track={track} groupId={group.id} viewId={viewId} />
            : (
              <TrackOutline
                items={outline}
                track={track}
                group={group}
                canEdit={canAdminister}
                onOpenPost={viewPostDetails}
                onStartEditing={() => setEditing(true)}
                onEnroll={handleEnroll}
              />
              )}
      </div>
    </div>
  )
}
