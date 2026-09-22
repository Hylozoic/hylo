import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useParams } from 'react-router-dom'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import ProfileListFooter from '../ProfileListFooter'
import usePagedProfileList from '../usePagedProfileList'
import { getMemberReactions, fetchMemberReactions } from './MemberReactions.store'
import classes from './MemberReactions.module.scss'

const PAGE_SIZE = 20

const MemberReactions = ({ routeParams: routeParamsProp, loading: loadingProp }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const params = useParams()
  const routeParams = routeParamsProp?.personId ? routeParamsProp : params
  const personId = routeParams.personId
  const requestPage = useCallback(offset => {
    return dispatch(fetchMemberReactions(personId, 'desc', PAGE_SIZE, offset))
  }, [dispatch, personId])
  const readSet = useCallback(person => person && person.reactions, [])
  const { ids, hasMore, loadingMore, settled, sentinelRef } = usePagedProfileList({
    personId,
    pageSize: PAGE_SIZE,
    requestPage,
    readSet
  })
  const idSet = new Set(ids)
  const reactions = (useSelector(state => getMemberReactions(state, { routeParams })) || [])
    .filter(reaction => idSet.has(String(reaction.id)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId
  const showInitialLoading = reactions.length === 0 && !settled && loadingProp !== false

  if (showInitialLoading) return <Loading />

  return (
    <div>
      {reactions.map(reaction =>
        <div className={classes.activityItem} key={reaction.id}>
          <PostCard post={reaction.post} expanded={itemSelected(reaction.post.id)} />
        </div>
      )}
      <ProfileListFooter
        t={t}
        settled={settled}
        hasMore={hasMore}
        loadingMore={loadingMore}
        hasItems={reactions.length > 0}
        sentinelRef={sentinelRef}
      />
    </div>
  )
}

export default MemberReactions
