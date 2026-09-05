import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Loading from 'components/Loading'
import PostCard from 'components/PostCard'
import presentPost from 'store/presenters/presentPost'
import getPerson from 'store/selectors/getPerson'
import isPendingFor from 'store/selectors/isPendingFor'
import { FETCH_MEMBER_POSTS } from '../MemberProfile.store'
import {
  fetchMemberPosts,
  PAGE_SIZE
} from './MemberPosts.store'
import classes from './MemberPosts.module.scss'

/**
 * Ensure each post has creator details. On public profiles the author is this person;
 * GraphQL may omit nested creator for anon viewers even though the posts are public.
 */
function withCreator (post, profilePerson) {
  if (post?.creator?.id && post?.creator?.avatarUrl) return post
  if (!profilePerson) return post

  return {
    ...post,
    creator: {
      id: profilePerson.id,
      name: profilePerson.name,
      avatarUrl: profilePerson.avatarUrl,
      ...(post.creator || {})
    }
  }
}

export default function MemberPosts ({ routeParams = {} }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const personId = routeParams.personId
  const pending = useSelector(state => isPendingFor(FETCH_MEMBER_POSTS, state))
  const profilePerson = useSelector(state => {
    const person = getPerson(state, { personId })
    return person
      ? { id: person.id, name: person.name, avatarUrl: person.avatarUrl }
      : null
  })

  const [offset, setOffset] = useState(0)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)
  const loadingRef = useRef(false)
  const profilePersonRef = useRef(profilePerson)
  profilePersonRef.current = profilePerson

  const loadPage = useCallback(async (nextOffset) => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (nextOffset > 0) setLoadingMore(true)

    try {
      const result = await dispatch(fetchMemberPosts(personId, PAGE_SIZE, nextOffset))
      const page = result?.payload?.data?.person?.posts
      const personData = result?.payload?.data?.person
      const fallbackCreator = profilePersonRef.current || (personData && {
        id: personData.id,
        name: personData.name,
        avatarUrl: personData.avatarUrl
      })

      const items = (page?.items || [])
        .map(post => presentPost(withCreator(post, fallbackCreator)))
        .filter(Boolean)

      setHasMore(!!page?.hasMore)
      setOffset(nextOffset)
      setPosts(prev => nextOffset === 0
        ? items
        : [...prev, ...items.filter(p => !prev.some(existing => existing.id === p.id))])
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [dispatch, personId])

  useEffect(() => {
    setPosts([])
    setOffset(0)
    setHasMore(true)
    setLoadingMore(false)
    loadingRef.current = false
    loadPage(0)
  }, [personId, loadPage])

  // If profile person loads after the first page, backfill missing creator avatars
  useEffect(() => {
    if (!profilePerson) return
    setPosts(prev => prev.map(post => {
      if (post?.creator?.avatarUrl) return post
      return presentPost(withCreator(post, profilePerson)) || post
    }))
  }, [profilePerson])

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return
    loadPage(offset + PAGE_SIZE)
  }, [hasMore, loadPage, offset])

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

  const itemSelected = selectedItemId => selectedItemId === routeParams.postId

  if (pending && offset === 0 && posts.length === 0) return <Loading />

  return (
    <div>
      {posts.map(post =>
        <div className={classes.activityItem} key={post.id}>
          <PostCard post={post} expanded={itemSelected(post.id)} />
        </div>
      )}
      {loadingMore && <Loading />}
      {!hasMore && !loadingMore && posts.length > 0 && (
        <div className='text-center text-foreground/50 py-4'>{t('No more posts to load')}</div>
      )}
      {posts.length === 0 && !pending && (
        <div className='text-center text-foreground/50 py-4'>{t('No posts yet')}</div>
      )}
      <div ref={sentinelRef} />
    </div>
  )
}
