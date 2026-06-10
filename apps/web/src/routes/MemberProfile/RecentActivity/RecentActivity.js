import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import CommentCard from 'components/CommentCard'
import isPendingFor from 'store/selectors/isPendingFor'
import {
  getRecentActivity,
  fetchRecentActivity,
  hasMoreActivity,
  FETCH_RECENT_ACTIVITY
} from './RecentActivity.store'

export default function RecentActivity ({ routeParams = {} }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const personId = routeParams.personId

  const activityItems = useSelector(state => getRecentActivity(state, { routeParams }))
  const person = useSelector(state => state.orm?.Person?.itemsById?.[personId])
  const hasMore = hasMoreActivity(person)
  const loading = useSelector(state => isPendingFor(FETCH_RECENT_ACTIVITY, state))

  const [offset, setOffset] = useState(0)
  const [items, setItems] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  const fetchRecent = useCallback((nextOffset) => {
    dispatch(fetchRecentActivity(personId, 10, nextOffset))
  }, [dispatch, personId])

  useEffect(() => {
    offsetRef.current = 0
    setOffset(0)
    setItems([])
    setLoadingMore(false)
    fetchRecent(0)
  }, [personId, fetchRecent])

  useEffect(() => {
    if (activityItems === undefined) return
    const o = offsetRef.current
    setItems(prev => (o === 0 ? activityItems : [...prev, ...activityItems]))
    setLoadingMore(false)
  }, [activityItems])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setOffset(prev => {
      const next = prev + 10
      dispatch(fetchRecentActivity(personId, 10, next))
      return next
    })
  }, [dispatch, personId, hasMore, loadingMore])

  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return
    const observer = new window.IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMoreRef.current()
        }
      },
      { rootMargin: '200px' }
    )
    const el = sentinelRef.current
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [personId])

  const itemSelected = useCallback(
    selectedItemId => selectedItemId === routeParams.postId,
    [routeParams.postId]
  )

  if (loading && offset === 0) return <Loading />

  return (
    <div>
      {items && items.map((item, i) => (
        <div className='bg-transparent' key={i} data-testid='activity-item'>
          {Object.prototype.hasOwnProperty.call(item, 'title')
            ? <PostCard post={item} expanded={itemSelected(item.id)} />
            : <CommentCard comment={item} expanded={itemSelected(item.post.id)} />}
        </div>
      ))}
      {loadingMore && <Loading />}
      {!hasMore && !loadingMore && items.length > 0 && (
        <div className='text-center text-gray-500 py-4'>{t('No more activity to load')}</div>
      )}
      <div ref={sentinelRef} />
    </div>
  )
}
