import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import ProfileListFooter from '../ProfileListFooter'
import { mergeIds, pageHasMore, personFromResult } from '../profilePaging'
import useScrollSentinel from '../useScrollSentinel'
import PostCard from 'components/PostCard'
import CommentCard from 'components/CommentCard'
import {
  getRecentActivity,
  fetchRecentActivity
} from './RecentActivity.store'

const PAGE_SIZE = 20

function isPostItem (item) {
  return Object.prototype.hasOwnProperty.call(item, 'title')
}

export default function RecentActivity ({ routeParams = {} }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const personId = routeParams.personId

  const activityItems = useSelector(state => getRecentActivity(state, { routeParams })) || []

  const [postIds, setPostIds] = useState([])
  const [commentIds, setCommentIds] = useState([])
  const [postsHasMore, setPostsHasMore] = useState(false)
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [settled, setSettled] = useState(false)

  const postIdsRef = useRef([])
  const commentIdsRef = useRef([])
  const postsOffsetRef = useRef(0)
  const commentsOffsetRef = useRef(0)
  const postsHasMoreRef = useRef(false)
  const commentsHasMoreRef = useRef(false)
  const loadingRef = useRef(false)

  const applyCollections = useCallback((person, { posts, comments }) => {
    if (posts) {
      const merged = mergeIds(postIdsRef.current, person?.posts?.items)
      postIdsRef.current = merged.ids
      setPostIds(merged.ids)
      postsHasMoreRef.current = pageHasMore(person?.posts, merged.added, PAGE_SIZE)
      setPostsHasMore(postsHasMoreRef.current)
    }
    if (comments) {
      const merged = mergeIds(commentIdsRef.current, person?.comments?.items)
      commentIdsRef.current = merged.ids
      setCommentIds(merged.ids)
      commentsHasMoreRef.current = pageHasMore(person?.comments, merged.added, PAGE_SIZE)
      setCommentsHasMore(commentsHasMoreRef.current)
    }
  }, [])

  const fetchPage = useCallback((postsOffset, commentsOffset) => {
    return dispatch(fetchRecentActivity(personId, PAGE_SIZE, { postsOffset, commentsOffset }))
  }, [dispatch, personId])

  useEffect(() => {
    let cancelled = false
    postIdsRef.current = []
    commentIdsRef.current = []
    postsOffsetRef.current = 0
    commentsOffsetRef.current = 0
    postsHasMoreRef.current = false
    commentsHasMoreRef.current = false
    loadingRef.current = false
    setPostIds([])
    setCommentIds([])
    setPostsHasMore(false)
    setCommentsHasMore(false)
    setLoadingMore(false)
    setSettled(false)
    fetchPage(0, 0).then(result => {
      if (cancelled) return
      applyCollections(personFromResult(result), { posts: true, comments: true })
      setSettled(true)
    }).catch(() => {
      if (cancelled) return
      postsHasMoreRef.current = false
      commentsHasMoreRef.current = false
      setPostsHasMore(false)
      setCommentsHasMore(false)
      setSettled(true)
    })
    return () => { cancelled = true }
  }, [personId, fetchPage, applyCollections])

  const loadMore = useCallback(async () => {
    const loadPosts = postsHasMoreRef.current
    const loadComments = commentsHasMoreRef.current
    if (loadingRef.current || (!loadPosts && !loadComments)) return
    loadingRef.current = true
    setLoadingMore(true)
    if (loadPosts) postsOffsetRef.current += PAGE_SIZE
    if (loadComments) commentsOffsetRef.current += PAGE_SIZE
    try {
      const result = await fetchPage(postsOffsetRef.current, commentsOffsetRef.current)
      applyCollections(personFromResult(result), { posts: loadPosts, comments: loadComments })
    } catch {
      if (loadPosts) {
        postsHasMoreRef.current = false
        setPostsHasMore(false)
      }
      if (loadComments) {
        commentsHasMoreRef.current = false
        setCommentsHasMore(false)
      }
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [applyCollections, fetchPage])

  const hasMore = postsHasMore || commentsHasMore
  const sentinelRef = useScrollSentinel(settled && hasMore && !loadingMore, loadMore, postIds.length + commentIds.length)

  const visibleItems = useMemo(() => {
    const posts = new Set(postIds)
    const comments = new Set(commentIds)
    return activityItems.filter(item => {
      const id = String(item.id)
      return isPostItem(item) ? posts.has(id) : comments.has(id)
    })
  }, [activityItems, postIds, commentIds])

  const itemSelected = useCallback(
    selectedItemId => selectedItemId === routeParams.postId,
    [routeParams.postId]
  )

  if (!settled && visibleItems.length === 0) return <Loading />

  return (
    <div>
      {visibleItems.map(item => {
        const isPost = isPostItem(item)
        return (
          <div className='bg-transparent' key={isPost ? `post-${item.id}` : `comment-${item.id}`} data-testid='activity-item'>
            {isPost
              ? <PostCard post={item} expanded={itemSelected(item.id)} />
              : <CommentCard comment={item} expanded={itemSelected(item.post.id)} />}
          </div>
        )
      })}
      <ProfileListFooter
        t={t}
        settled={settled}
        hasMore={hasMore}
        loadingMore={loadingMore}
        hasItems={visibleItems.length > 0}
        sentinelRef={sentinelRef}
      />
    </div>
  )
}
