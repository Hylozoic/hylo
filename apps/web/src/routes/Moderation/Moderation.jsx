import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Routes, Route, useLocation } from 'react-router-dom'

import Loading from 'components/Loading'
import ModerationListItem from 'components/ModerationListItem/ModerationListItem'
import NoPosts from 'components/NoPosts'
import PostDialog from 'components/PostDialog'
import ScrollListener from 'components/ScrollListener'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { fetchModerationActions, clearModerationAction } from 'store/actions/moderationActions'
import { FETCH_MODERATION_ACTIONS } from 'store/constants'
import orm from 'store/models'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMoreModerationActions, getModerationActions } from 'store/selectors/getModerationActions'
import { cn } from 'util/index'

export default function Moderation (props) {
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const { t } = useTranslation()
  const { groupSlug } = routeParams
  const context = props.context

  const [container, setContainer] = useState(null)

  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupId = group?.id || 0

  const pendingModerationActions = useSelector(state => state.pending[FETCH_MODERATION_ACTIONS])

  const fetchModerationActionParams = useMemo(() => {
    return {
      slug: groupSlug,
      groupId,
      sortBy: 'created'
    }
  }, [groupSlug, groupId])

  const moderationActions = useSelector(state => {
    return getModerationActions(state, fetchModerationActionParams)
  }, (prevModerationActions, nextModerationActions) => {
    if (prevModerationActions.length !== nextModerationActions.length) return false
    return prevModerationActions.every((item, index) => item.id === nextModerationActions[index].id && item.status === nextModerationActions[index].status)
  })
  const hasMoreModerationActions = useSelector(state => getHasMoreModerationActions(state, fetchModerationActionParams))

  const fetchModerationActionsAction = useCallback((offset) => {
    if (pendingModerationActions || hasMoreModerationActions === false) return
    return dispatch(fetchModerationActions({ offset, ...fetchModerationActionParams }))
  }, [pendingModerationActions, hasMoreModerationActions, fetchModerationActionParams])

  const handleClearModerationAction = useCallback((modAction) => {
    dispatch(clearModerationAction({ postId: modAction?.post?.id, moderationActionId: modAction?.id, groupId: group?.id }))
  }, [group?.id])

  useEffect(() => {
    fetchModerationActionsAction(0)
  }, [fetchModerationActionParams])

  // TODO: add sort and search
  // const changeSort = useCallback(sort => {
  //   dispatch(updateUserSettings({ settings: { streamSortBy: sort } }))
  //   dispatch(changeQuerystringParam(location, 's', sort, 'all'))
  // }, [location])

  // const changeSearch = useCallback(search => {
  //   dispatch(changeQuerystringParam(location, 'search', search, 'all'))
  // }, [location])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: 'Moderation',
      icon: 'Shield',
      search: true
    })
  }, [])

  return (
    <div id='outer-container' className='flex flex-col h-full overflow-auto' ref={setContainer}>
      <Helmet>
        <title>Moderation | {group ? `${group.name} | ` : context} | Hylo</title>
        <meta name='description' content={group ? `Moderation actions from ${group.name}. ${group.description}` : 'Group Not Found'} />
      </Helmet>

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>

      <div
        id='inner-container'
        className={cn(
          'flex flex-col flex-1 w-full mx-auto overflow-auto p-4'
        )}
      >
        <div className='streamItems'>
          {!pendingModerationActions && moderationActions?.length === 0 ? <NoPosts /> : ''}
          {moderationActions.map(modAction => {
            return (
              <ModerationListItem
                group={group}
                key={modAction.id}
                moderationAction={modAction}
                handleClearModerationAction={() => handleClearModerationAction(modAction)}
              />
            )
          })}
        </div>
        {(pendingModerationActions) && <Loading />}

        <ScrollListener
          onBottom={() => fetchModerationActionsAction(moderationActions.length)}
          elementId='outer-container'
        />
      </div>
    </div>
  )
}
