import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import ProfileListFooter from '../ProfileListFooter'
import usePagedProfileList from '../usePagedProfileList'
import {
  getMemberPosts,
  fetchMemberPosts
} from './MemberPosts.store'
import classes from './MemberPosts.module.scss'

const PAGE_SIZE = 20

export default function MemberPosts ({ routeParams = {}, loading: loadingProp }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const personId = routeParams.personId
  const requestPage = useCallback(offset => {
    return dispatch(fetchMemberPosts(personId, PAGE_SIZE, offset))
  }, [dispatch, personId])
  const readSet = useCallback(person => person && person.posts, [])
  const { ids, hasMore, loadingMore, settled, sentinelRef } = usePagedProfileList({
    personId,
    pageSize: PAGE_SIZE,
    requestPage,
    readSet
  })
  const idSet = new Set(ids)
  const posts = (useSelector(state => getMemberPosts(state, { routeParams })) || [])
    .filter(post => idSet.has(String(post.id)))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId
  const showInitialLoading = posts.length === 0 && !settled && loadingProp !== false

  if (showInitialLoading) return <Loading />

  return (
    <div>
      {posts.map(post =>
        <div className={classes.activityItem} key={post.id}>
          <PostCard post={post} expanded={itemSelected(post.id)} />
        </div>
      )}
      <ProfileListFooter
        t={t}
        settled={settled}
        hasMore={hasMore}
        loadingMore={loadingMore}
        hasItems={posts.length > 0}
        sentinelRef={sentinelRef}
      />
    </div>
  )
}
