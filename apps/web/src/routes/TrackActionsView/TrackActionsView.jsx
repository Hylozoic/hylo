import { DndContext, closestCorners } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { isEmpty } from 'lodash/fp'
import { Pencil, Plus, Shapes } from 'lucide-react'
import React, { useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { fetchViewPosts, reorderViewPost } from 'store/actions/groupViews'
import { RESP_ADMINISTRATION } from 'store/constants'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { addQuerystringToPath, createPostUrl } from '@hylo/navigation'
import { cn } from 'util/index'

import ActionSummary from './ActionSummary'

/** Renders a Track space's ordered action posts, with drag-and-drop reordering for space managers. */
export default function TrackActionsView () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
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
  const currentActionId = displayedPosts.find(p => !p.completedAt)?.id

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

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && over.id !== active.id && group?.id && viewId) {
      const overIndex = over.data.current.sortable.index
      dispatch(reorderViewPost({
        groupId: group.id,
        viewId,
        postId: active.id,
        order: overIndex
      }))
    }
  }

  const toggleEditing = () => {
    navigate(addQuerystringToPath(location.pathname, { edit: isEditing ? null : 'true' }), { replace: true })
  }

  if (!group || !groupViewsLoaded || !trackId) return <Loading />

  const { accessControlled, canAccess } = currentTrack
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
          onClick={toggleEditing}
          className='w-full text-foreground border-2 border-dashed border-foreground/30 hover:border-foreground/50 transition-all px-4 py-2 rounded-md flex flex-row items-center gap-2 justify-center mb-4'
        >
          <Pencil className='w-4 h-4' />
          <span>{isEditing ? t('Done Editing') : t('Edit {{actionDescriptorPlural}}', { actionDescriptorPlural: currentTrack.actionDescriptorPlural })}</span>
        </button>
      )}

      {!hasAccess && (
        <div className='border-2 border-dashed border-foreground/20 rounded-xl p-4 text-center my-4'>
          <p className='text-foreground/70'>{t('You need to be granted access to view the actions in this track.')}</p>
        </div>
      )}

      <div className={cn({ 'pointer-events-none opacity-50': !hasAccess })}>
        {isEditing
          ? (
            <>
              <DndContext
                onDragEnd={handleDragEnd}
                collisionDetection={closestCorners}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext items={displayedPosts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {displayedPosts.map(post => (
                    <ActionSummary key={post.id} post={post} trackId={trackId} groupId={group.id} viewId={viewId} />
                  ))}
                </SortableContext>
              </DndContext>
              <button
                className='w-full text-foreground border-2 border-foreground/20 hover:border-foreground/50 transition-all px-4 py-2 rounded-md mb-4 flex items-center justify-center gap-2'
                onClick={() => navigate(createPostUrl(routeParams, { newPostType: 'action', viewId }))}
              >
                <Plus className='w-4 h-4' />
                {t('Add {{actionDescriptor}}', { actionDescriptor: currentTrack.actionDescriptor })}
              </button>
            </>
            )
          : (
              postsMissing && displayedPosts.length === 0
                ? <Loading />
                : displayedPosts.map(post => (
                  <PostCard key={post.id} post={post} isCurrentAction={currentActionId === post.id} actionDescriptor={currentTrack.actionDescriptor} />
                ))
            )}
      </div>
    </div>
  )
}
