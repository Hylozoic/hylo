import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import CommentCard from 'components/CommentCard'
import ProfileListFooter from '../ProfileListFooter'
import usePagedProfileList from '../usePagedProfileList'
import {
  getMemberComments,
  fetchMemberComments
} from './MemberComments.store'
import classes from './MemberComments.module.scss'

const PAGE_SIZE = 20

export default function MemberComments ({ routeParams = {}, loading: loadingProp }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const personId = routeParams.personId
  const requestPage = useCallback(offset => {
    return dispatch(fetchMemberComments(personId, 'desc', PAGE_SIZE, offset))
  }, [dispatch, personId])
  const readSet = useCallback(person => person && person.comments, [])
  const { ids, hasMore, loadingMore, settled, sentinelRef } = usePagedProfileList({
    personId,
    pageSize: PAGE_SIZE,
    requestPage,
    readSet
  })
  const idSet = new Set(ids)
  const comments = (useSelector(state => getMemberComments(state, { routeParams })) || [])
    .filter(comment => idSet.has(String(comment.id)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId
  const showInitialLoading = comments.length === 0 && !settled && loadingProp !== false

  if (showInitialLoading) return <Loading />

  return (
    <div>
      {comments.map(comment =>
        <div className={classes.activityItem} key={comment.id}>
          <CommentCard
            comment={comment}
            routeParams={routeParams}
            expanded={itemSelected(comment.post.id)}
          />
        </div>
      )}
      <ProfileListFooter
        t={t}
        settled={settled}
        hasMore={hasMore}
        loadingMore={loadingMore}
        hasItems={comments.length > 0}
        sentinelRef={sentinelRef}
      />
    </div>
  )
}
