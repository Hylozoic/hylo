import isMobile from 'ismobilejs'
import { debounce } from 'lodash/fp'
import { ChevronDown, Copy, MessageSquareMore, Send } from 'lucide-react'
import { DateTimeHelpers, postCountsTowardChatUnread } from '@hylo/shared'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, Routes, Route, useNavigate } from 'react-router-dom'
import { VirtuosoMessageList, VirtuosoMessageListLicense, useVirtuosoLocation, useVirtuosoMethods } from '@virtuoso.dev/message-list'

import { getSocket } from 'client/websockets.js'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import ChatEditor from 'components/ChatEditor'
import Loading from 'components/Loading'
import PeopleTyping from 'components/PeopleTyping'
import { StreamSkeleton } from 'components/PostCard/PostCardSkeleton'
import NoPosts from 'components/NoPosts'
import PostDialog from 'components/PostDialog'
import Tooltip from 'components/Tooltip'
import Button from 'components/ui/button'
import ChatMembersPanel from './ChatMembersPanel'
import ChatPost from './ChatPost'
import ChatPostNotice from './ChatPostNotice'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchPosts from 'store/actions/fetchPosts'
import updateGroupViewUser from 'store/actions/updateGroupViewUser'
import { FETCH_POSTS, RESP_ADD_MEMBERS } from 'store/constants'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import presentPost from 'store/presenters/presentPost'
import { makeDropQueryResults, makeQueryResultsModelSelector } from 'store/reducers/queryResults'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getPostResults } from 'store/selectors/getPosts'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { cn } from 'util/index'
import { groupInviteUrl, groupUrl } from '@hylo/navigation'
import { isLegacyWebView } from 'util/webView'
import { formatLocalizedDate } from 'util/dateFormat'
import { getLocaleFromLocalStorage } from 'util/locale'

import styles from './ChatRoom.module.scss'

// the maximum amount of time in minutes that can pass between messages to still
// include them under the same avatar and timestamp
const MAX_MINS_TO_BATCH = 5

// Messages clamp to this width for readability; the drag rail at the clamp edge
// lets people widen the stream Discord-style. The choice sticks via localStorage.
const CHAT_WIDTH_KEY = 'hyloChatStreamWidth'
const DEFAULT_CHAT_WIDTH = 750
const MIN_CHAT_WIDTH = 480
// The list's sm+ px-5 gutter — the rail only exists on viewports wide enough
// that the below-sm gutter never applies, and dragging right stops at a
// matching gutter's distance from the right edge.
const CHAT_GUTTER = 20
// Slack past the clamp edge required before the rail appears at all
const CHAT_RAIL_SLACK = 40
// The rail sits wholly right of the stream: its background's left edge IS the
// stream's endpoint, with the dashed line at the rail's own centre
const CHAT_RAIL_WIDTH = 30

// IMPORTANT: Use a selector factory so multiple prop-driven queries don't thrash a single memo cache
// Preserve the order defined by queryResults.ids and transform to presentPost
const makeGetPostsSelector = () => makeQueryResultsModelSelector(getPostResults, 'Post', p => presentPost(p))

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

// Hack to fix focusing on editor after it unmounts/remounts
EditorView.prototype.updateState = function updateState (state) {
  if (!this.docView) return // This prevents the matchesNode error on hot reloads
  this.updateStateInner(state, this.state.plugins !== state.plugins)
}

const getDisplayDay = (date) => {
  return date.hasSame(DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()), 'day')
    ? 'Today'
    : date.hasSame(DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).minus({ days: 1 }), 'day')
      ? 'Yesterday'
      : formatLocalizedDate(date, { style: 'medium' })
}

/**
 * Extracts a clean numeric post id from a querystring postId value.
 * Older mobile clients could mangle deep-link URLs into e.g. ?postId=123?postId=123,
 * which would otherwise flow into the posts query cursor and error out the fetch.
 */
const sanitizePostId = (postId) => {
  const matched = postId && String(postId).match(/^\d+/)
  return matched ? matched[0] : null
}

/**
 * List index to show after load (posts sorted by id ascending).
 */
const computeChatInitialScrollIndex = (sortedPosts, postIdToStartAt, lastReadPostId) => {
  if (!sortedPosts?.length) return 0

  // Set initial scroll to the passed in post to scroll to, otherwise to the last read post
  const postToScrollTo = postIdToStartAt || lastReadPostId
  if (!postToScrollTo) return 0

  // XXX: We set the lastReadPostId to the largest post id as a hack to bring people to the most recent post when they join a chat room
  const lastId = sortedPosts[sortedPosts.length - 1].id
  if (postToScrollTo > lastId) return sortedPosts.length - 1

  const postToScrollToIndex = sortedPosts.findIndex(post => post.id === postToScrollTo)
  if (postToScrollToIndex !== -1) {
    return Math.max(postToScrollToIndex, 0)
  }

  // XXX: When joining a room we set the lastReadPostId to the largest post id in the database as a hack to bring people to the most recent post when they join a chat room
  // But more posts could have been added since we did this, so we if we can't find the last read post id, we scroll to the most recent post
  return sortedPosts.length - 1
}

export default function ChatRoom (props) {
  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const location = useLocation()
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isLegacyWebView() || hideNavLayout
  const { t } = useTranslation()

  const effectiveGroupSlug = useEffectiveGroupSlug()
  const groupSlug = props.groupSlug || effectiveGroupSlug
  const showHomeWelcome = props.showHomeWelcome ?? !props.groupSlug
  const { postId: selectedPostId } = routeParams

  const context = props.context || routeParams.context

  const socket = useMemo(() => getSocket(), [])

  const currentUser = useSelector(getMe)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useSelector(state => getGroupViews(state, group))
  const chatView = groupViews.find(v => v.type === 'chat') || null
  const showPostNoticesInChat = group?.settings?.showPostNoticesInChat ?? true

  const chatViewLoading = !!group?.id && !chatView
  const groupLoading = !!groupSlug && !group

  const querystringParams = getQuerystringParam(['search', 'postId'], location)
  const search = querystringParams?.search
  const [postIdToStartAt, setPostIdToStartAt] = useState(sanitizePostId(querystringParams?.postId))

  const [container, setContainer] = React.useState(null)
  const messageListRef = useRef(null)
  /**
   * Monotonic “generation” for which chat room the list is showing. We bump it on every room entry
   * (see chatView effect). In-flight `fetchPosts` requests capture `epoch` when they start; when
   * they finish they compare to `chatListEpochRef.current`. If different, the user already left
   * that room — we skip `prepend`/`append` and skip treating that response as authoritative for UI.
   *
   * Why: Virtuoso is not remounted per room (no `key`), so `messageListRef` is stable. Without this,
   * a slow network response for room A could still call `data.prepend` after the user opened room B,
   * corrupting the list or marking the wrong room loaded.
   */
  const chatListEpochRef = useRef(0)
  // Tracks whether the tab was actually hidden before reconciling on foreground return.
  const tabWasHiddenRef = useRef(false)
  /** True while the chat composer has focus — avoids spurious scroll pagination from layout shifts. */
  const composerFocusedRef = useRef(false)

  // Tracks the lastReadPostId we have committed locally — updated synchronously on create and on scroll updates,
  // so closures can check it without waiting for the Redux ORM re-render cycle.
  const lastReadPostIdRef = useRef(chatView?.lastReadPostId)

  // The last post seen by the current user. Doesn't update in real time as they scroll only when room is reloaded
  const [latestOldPostId, setLatestOldPostId] = useState(chatView?.lastReadPostId)

  // Whether we are currently loading more past posts or future posts
  const [loadingPast, setLoadingPast] = useState(false)
  const [loadingFuture, setLoadingFuture] = useState(false)
  const [loadedPast, setLoadedPast] = useState(false)
  const [loadedFuture, setLoadedFuture] = useState(false)
  const [initialPostToScrollTo, setInitialPostToScrollTo] = useState(null)

  // Add this new state to track if initial animation is complete
  const [initialAnimationComplete, setInitialAnimationComplete] = useState(false)

  // The number of posts that should fill a screen plus a few more to make sure we have enough posts to scroll through
  // DEPRECATED: Load same number for all mobile (including webview)
  const INITIAL_POSTS_TO_LOAD = isMobile.any ? 17 : 25

  const chatFetchBaseParams = useMemo(() => ({
    childPostInclusion: 'no',
    includePostGroups: false,
    fieldsVariant: 'chatRoom',
    context,
    slug: groupSlug,
    search,
    sortBy: 'id',
    filter: 'chat',
    ...(showPostNoticesInChat ? {} : { types: ['chat'] })
  }), [context, groupSlug, search, showPostNoticesInChat])

  const fetchPostsPastParams = useMemo(() => ({
    ...chatFetchBaseParams,
    cursor: postIdToStartAt ? parseInt(postIdToStartAt) + 1 : parseInt(chatView?.lastReadPostId) + 1,
    first: Math.max(INITIAL_POSTS_TO_LOAD - (chatView?.newPostCount || 0), 3),
    order: 'desc'
  }), [chatFetchBaseParams, postIdToStartAt, chatView?.lastReadPostId, chatView?.newPostCount])

  const fetchPostsFutureParams = useMemo(() => ({
    ...chatFetchBaseParams,
    cursor: postIdToStartAt || chatView?.lastReadPostId,
    first: Math.min(INITIAL_POSTS_TO_LOAD, chatView?.newPostCount || 0),
    order: 'asc'
  }), [chatFetchBaseParams, postIdToStartAt, chatView?.lastReadPostId, chatView?.newPostCount])

  // Use per-instance memoized selectors to avoid cache thrashing between different prop sets
  const getPostsPastSelector = useMemo(() => makeGetPostsSelector(), [])
  const getPostsFutureSelector = useMemo(() => makeGetPostsSelector(), [])

  const postsPast = useSelector(state => getPostsPastSelector(state, fetchPostsPastParams))
  const hasMorePostsPast = useSelector(state => getPostResults(state, fetchPostsPastParams)?.hasMore)

  const postsFuture = useSelector(state => getPostsFutureSelector(state, fetchPostsFutureParams))
  const hasMorePostsFuture = useSelector(state => getPostResults(state, fetchPostsFutureParams)?.hasMore)

  // True only after at least one fetch has completed for the current room's query params.
  // hasMore is undefined until a response is stored, so this resets automatically on room switch.
  const hasFetchedForCurrentRoom = hasMorePostsPast !== undefined || hasMorePostsFuture !== undefined

  const postsForDisplay = useMemo(() => {
    if (!postsPast && !postsFuture) return []
    const allPosts = [...(postsPast || []), ...(postsFuture || [])].filter(Boolean)
    // Deduplicate posts by ID (can happen when socket adds posts to Redux while viewing another room)
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.id, post])).values()
    )
    return uniquePosts.sort((a, b) => Number(a.id) - Number(b.id))
  }, [postsPast, postsFuture])

  // Keep the on-screen Virtuoso data in sync when any post updates elsewhere (edit, comment, react)
  useEffect(() => {
    if (!messageListRef.current) return
    if (!postsForDisplay || postsForDisplay.length === 0) return

    const byId = new Map(postsForDisplay.map(p => [p.id, p]))
    messageListRef.current?.data.map(item => {
      const updated = item?.id ? byId.get(item.id) : null
      return updated ? { ...item, ...updated } : item
    })
  }, [postsForDisplay])

  const fetchPostsPast = useCallback((offset, extraParams = {}, force = false) => {
    if ((loadingPast || hasMorePostsPast === false) && !force) return Promise.resolve()
    // Snapshot the room generation for this request — if the user switches chats before this resolves, epoch will mismatch.
    const epoch = chatListEpochRef.current
    setLoadingPast(true)
    return dispatch(fetchPosts({ ...fetchPostsPastParams, offset, ...extraParams }))
      .then((action) => {
        const posts = action.payload?.data?.group?.posts?.items || []
        const newPosts = posts.map(p => presentPost(p, group.id)).filter(Boolean)
        setLoadingPast(false)
        // Stale response: do not mutate the list (another room’s epoch is active).
        if (epoch !== chatListEpochRef.current) return
        if (newPosts.length > 0) {
          const batch = newPosts.reverse()
          queueMicrotask(() => {
            // Re-check after microtask — room may have changed in the same tick as the network return.
            if (epoch !== chatListEpochRef.current) return
            messageListRef.current?.data.prepend(batch)
          })
        }
      })
      .catch(() => setLoadingPast(false))
  }, [fetchPostsPastParams, loadingPast, hasMorePostsPast, group?.id])

  const fetchPostsFuture = useCallback((offset, extraParams = {}, force = false) => {
    if ((loadingFuture || hasMorePostsFuture === false) && !force) return Promise.resolve()
    // Same epoch snapshot as fetchPostsPast — ties this response to the room that was active when we dispatched.
    const epoch = chatListEpochRef.current
    setLoadingFuture(true)
    return dispatch(fetchPosts({ ...fetchPostsFutureParams, offset, ...extraParams })).then((action) => {
      setLoadingFuture(false)
      // Stale: user left this chat — do not append to the current list.
      if (epoch !== chatListEpochRef.current) return 0
      const newPosts = (action.payload?.data?.group?.posts?.items || []).map(p => presentPost(p, group.id)).filter(Boolean)
      queueMicrotask(() => {
        // Same re-check as prepend path — switch room before the microtask runs.
        if (epoch !== chatListEpochRef.current) return
        if (offset === 0) {
          messageListRef.current?.data.append(newPosts, () => ({ index: 'LAST', align: 'end', behavior: 'auto' }))
        } else {
          messageListRef.current?.data.append(newPosts)
        }
      })
      return newPosts.length
    }).catch(() => {
      // Without this catch a failed fetch rejects through the callers' .then chains,
      // loadedFuture never flips true and the room is stuck on the loading skeleton
      setLoadingFuture(false)
      return 0
    })
  }, [fetchPostsFutureParams, loadingFuture, hasMorePostsFuture, group?.id])

  /**
   * Jump to the newest chat posts, scroll to bottom, and mark the room fully read.
   * Always hard-resets to the latest window — stale newPostCount / hasMoreFuture=false
   * previously left people stranded mid-history and spammed UPDATE_GROUP_VIEW_USER.
   */
  const loadToLatest = useCallback(async () => {
    if (!chatView?.id || !group?.id) return

    const epoch = chatListEpochRef.current
    const unread = chatView.newPostCount || 0

    // Nothing unread — StickyFooter will just scroll to the already-loaded bottom.
    if (unread === 0) return

    // Sentinel cursor beyond any real post id. Setting postIdToStartAt aligns Redux
    // query keys with this window so scroll-up pagination keeps working afterward.
    const jumpId = String(Number.MAX_SAFE_INTEGER)
    const pastParams = {
      ...chatFetchBaseParams,
      cursor: parseInt(jumpId, 10) + 1,
      first: INITIAL_POSTS_TO_LOAD,
      order: 'desc'
    }
    const futureParams = {
      ...chatFetchBaseParams,
      cursor: jumpId,
      // No posts exist after the sentinel; record an empty future page so hasMore is false.
      first: 1,
      order: 'asc'
    }

    setPostIdToStartAt(jumpId)
    setLoadedFuture(false)
    setLoadedPast(false)
    setInitialPostToScrollTo(null)

    dispatch(dropPostResults(fetchPostsFutureParams))
    dispatch(dropPostResults(fetchPostsPastParams))
    dispatch(dropPostResults(pastParams))
    dispatch(dropPostResults(futureParams))

    messageListRef.current?.data.replace([], { purgeItemSizes: true })

    const pastAction = await dispatch(fetchPosts({ ...pastParams, offset: 0 }))
    await dispatch(fetchPosts({ ...futureParams, offset: 0 }))

    if (epoch !== chatListEpochRef.current) return

    const items = (pastAction.payload?.data?.group?.posts?.items || [])
      .map(p => presentPost(p, group.id))
      .filter(Boolean)
      .sort((a, b) => Number(a.id) - Number(b.id))

    queueMicrotask(() => {
      if (epoch !== chatListEpochRef.current) return
      const lastIndex = Math.max(items.length - 1, 0)
      messageListRef.current?.data.replace(items, {
        purgeItemSizes: true,
        initialLocation: items.length > 0
          ? { index: lastIndex, align: 'end' }
          : undefined
      })
    })

    setLoadedPast(true)
    setLoadedFuture(true)
    if (items.length > 0) {
      setInitialPostToScrollTo(items.length - 1)
    }

    const latestPost = items[items.length - 1]
    if (latestPost?.id) {
      lastReadPostIdRef.current = latestPost.id
      setLatestOldPostId(latestPost.id)
      dispatch(updateGroupViewUser(chatView.id, { lastReadPostId: latestPost.id }, group.id))
    }
  }, [
    chatView?.id,
    chatView?.newPostCount,
    group?.id,
    dispatch,
    fetchPostsFutureParams,
    fetchPostsPastParams,
    chatFetchBaseParams
  ])

  const reconcileChatOnForeground = useCallback(() => {
    if (!group?.id) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    // Catch up in case socket events were missed while the tab/app was backgrounded.
    dispatch(fetchGroupViews(group.id))
    fetchPostsFuture(0, { first: INITIAL_POSTS_TO_LOAD }, true)
  }, [dispatch, fetchPostsFuture, group?.id])

  const handleNewPostReceived = useCallback((data) => {
    if (!group?.id) return
    if (!data.groups?.some(g => String(g.id) === String(group.id))) return
    // Chat activity cards belong in All Activity, not the chat timeline
    if (!postCountsTowardChatUnread(data.type, showPostNoticesInChat)) return
    const post = presentPost(data, group.id)
    if (!post) return

    // Confirmed posts don't need localId — clear it to prevent stale rehydrated localIds from causing future key collisions
    const confirmedPost = { ...post, localId: undefined }

    let updateExisting = false
    messageListRef.current?.data.map((item) => {
      if (post.id === item.id || (item.pending && post.localId && post.localId === item.localId)) {
        updateExisting = true
        return confirmedPost
      } else {
        return item
      }
    })

    if (!updateExisting) {
      messageListRef.current?.data.append(
        [confirmedPost],
        ({ atBottom, scrollInProgress }) => {
          if (atBottom || scrollInProgress) {
            // 'smooth' scrolls to the item's ESTIMATED height; on narrow screens
            // the text wraps taller than estimated, so the animation lands shy of
            // the bottom — half a message showing — and never re-corrects. Snap
            // the last stretch once the real height is measured, unless the
            // reader has meanwhile scrolled away.
            setTimeout(() => {
              try {
                const location = messageListRef.current?.getScrollLocation?.()
                if (location && location.bottomOffset < 200) {
                  messageListRef.current?.scrollToItem({ index: 'LAST', align: 'end', behavior: 'auto' })
                }
              } catch (e) {}
            }, 350)
            return 'smooth'
          } else {
            // setUnseenMessages((val) => val + 1) TODO
            return false
          }
        })
    }
  }, [group?.id, showPostNoticesInChat])

  const resetInitialPostToScrollTo = useCallback(() => {
    if (loadedPast && loadedFuture) {
      setInitialPostToScrollTo(
        computeChatInitialScrollIndex(postsForDisplay, postIdToStartAt, chatView?.lastReadPostId)
      )
    } else {
      setInitialPostToScrollTo(null)
    }
  }, [loadedPast, loadedFuture, postsForDisplay, postIdToStartAt, chatView?.lastReadPostId])

  useEffect(() => {
    if (groupSlug && !group) dispatch(fetchForGroup(groupSlug))
  }, [dispatch, groupSlug, group])

  useEffect(() => {
    if (!group?.id || chatView?.id) return
    dispatch(fetchGroupViews(group.id))
  }, [dispatch, group?.id, chatView?.id])

  useEffect(() => {
    socket.on('newPost', handleNewPostReceived)

    return () => {
      socket.off('newPost', handleNewPostReceived)
    }
  }, [socket, handleNewPostReceived])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        tabWasHiddenRef.current = true
        return
      }
      if (document.visibilityState === 'visible' && tabWasHiddenRef.current) {
        tabWasHiddenRef.current = false
        reconcileChatOnForeground()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [reconcileChatOnForeground])

  useEffect(() => {
    // New chat room loaded, reset everything
    if (chatView?.id) {
      // Invalidate every in-flight fetch / deferred work from the previous room (see chatListEpochRef).
      chatListEpochRef.current += 1
      // Same numeric generation that fetchPostsPast/Future snapshot as `epoch` when they dispatch — keep in sync.
      const roomEpoch = chatListEpochRef.current
      // Check if we already have cached data for this room (must have rows we can actually render)
      const hasCachedPastData = postsPast && postsPast.length > 0
      const hasCachedFutureData = postsFuture && postsFuture.length > 0
      const hasCachedData =
        (hasCachedPastData || hasCachedFutureData) && postsForDisplay.length > 0

      // Defer replace so Virtuoso’s ref is attached; `initialLocation` on replace restores scroll without remounting.
      const nextList = hasCachedData ? postsForDisplay : []
      const lastReadForScroll = chatView.lastReadPostId
      queueMicrotask(() => {
        // Another room switch bumped the global epoch — don’t apply this room’s replace.
        if (roomEpoch !== chatListEpochRef.current) return
        const ref = messageListRef.current
        if (!ref) return
        const replaceOpts = { purgeItemSizes: true }
        if (nextList.length > 0) {
          const idx = Math.min(
            computeChatInitialScrollIndex(nextList, postIdToStartAt, lastReadForScroll),
            nextList.length - 1
          )
          replaceOpts.initialLocation = { index: idx, align: 'start-no-overflow' }
        }
        ref.data.replace(nextList, replaceOpts)
      })

      if (hasCachedData) {
        // We have cached data, use it immediately without showing loading state
        setLoadedPast(true)
        setLoadedFuture(true)
        // Still fetch future posts in the background to pick up any new ones since last visit
        if (chatView.newPostCount > 0) {
          fetchPostsFuture(0, {}, true)
        }
      } else {
        // No cached data, fetch fresh
        setLoadedFuture(false)
        setLoadedPast(false)

        if (chatView.newPostCount > 0) {
          // force: room re-entry must run even if persisted query said hasMore=false (e.g. user had loaded all history)
          fetchPostsFuture(0, {}, true).then(() => {
            // Only flip loaded for the room this effect opened — not for an abandoned fetch after a fast tab switch.
            if (roomEpoch === chatListEpochRef.current) setLoadedFuture(true)
          })
        } else {
          setLoadedFuture(true)
        }

        // force: same — otherwise fetchPostsPast no-ops when hasMorePostsPast is false from cache but the list is empty
        fetchPostsPast(0, {}, true).then(() => {
          // Match fetchPostsFuture: stale responses must not set loadedPast for a room the user already left.
          if (roomEpoch === chatListEpochRef.current) setLoadedPast(true)
        })
      }

      resetInitialPostToScrollTo()

      // Reset marker of new posts
      setLatestOldPostId(chatView.lastReadPostId)
      lastReadPostIdRef.current = chatView.lastReadPostId
    }
  }, [chatView?.id, groupSlug])

  // Do once after loading posts for the room to get things ready
  useEffect(() => {
    resetInitialPostToScrollTo()
  }, [loadedPast, loadedFuture])

  // Add this useEffect to mark initial animation as complete after a timeout
  useEffect(() => {
    if (loadedPast && loadedFuture && !initialAnimationComplete) {
      // Set a timeout slightly longer than the maximum animation delay (2000ms)
      const timer = setTimeout(() => {
        setInitialAnimationComplete(true)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [loadedPast, loadedFuture, initialAnimationComplete])

  // Reset new_post_count when we're at the true latest loaded post and last-read can advance.
  // Do not re-dispatch the same lastReadPostId — that infinite-looped when newPostCount was stale
  // (hasMoreFuture false while unread posts still existed beyond the loaded window).
  useEffect(() => {
    if (loadedPast && loadedFuture &&
        (chatView?.newPostCount || 0) > 0 &&
        hasMorePostsFuture === false &&
        postsForDisplay.length > 0) {
      const latestPost = postsForDisplay[postsForDisplay.length - 1]
      if (latestPost?.id && chatView?.id && group?.id &&
          parseInt(latestPost.id) > parseInt(lastReadPostIdRef.current || 0)) {
        lastReadPostIdRef.current = latestPost.id
        dispatch(updateGroupViewUser(chatView.id, { lastReadPostId: latestPost.id }, group.id))
      }
    }
  }, [loadedPast, loadedFuture, chatView?.newPostCount, chatView?.id, hasMorePostsFuture, postsForDisplay, group?.id, dispatch])

  useEffect(() => {
    if (querystringParams?.postId) {
      const targetPostId = sanitizePostId(querystringParams.postId)
      if (targetPostId) {
        setPostIdToStartAt(targetPostId)
        const index = messageListRef.current?.data.findIndex(post => post.id === targetPostId)
        if (index !== -1) {
          messageListRef.current?.scrollToItem({ index, align: 'start-no-overflow', behavior: 'auto' })
        } else if (loadedFuture && loadedPast) {
          // Can't find the post in the list, so we need to load a new set of posts around the one we want to scroll to
          // Basically just reset the list

          // Drop post results from Redux store (only need to call once)
          dispatch(dropPostResults(fetchPostsFutureParams))
          dispatch(dropPostResults(fetchPostsPastParams))

          // Reset loading states
          setLoadedFuture(false)
          setLoadedPast(false)

          messageListRef.current?.data.replace([], {
            purgeItemSizes: true
          })

          // Load new data centered around the target post
          Promise.all([
            // We don't know how many posts are before or after the target post, so we load the initial number of posts to fill the screen
            fetchPostsFuture(0, { cursor: targetPostId, first: INITIAL_POSTS_TO_LOAD }, true)
              .then(() => setLoadedFuture(true)),
            fetchPostsPast(0, { cursor: parseInt(targetPostId) + 1, first: INITIAL_POSTS_TO_LOAD }, true)
              .then(() => setLoadedPast(true))
          ])
        }
      }

      // Remove the scroll to post from the url so we can click on a notification to scroll to it again
      // DEPRECATED: Now always clean up the URL parameter
      // if (!isWebView()) {
      dispatch(changeQuerystringParam(location, 'postId', null, null, true))
      // }
    }
  }, [querystringParams?.postId])

  const onScroll = useMemo(
    () => debounce(200, (location) => {
      if (!loadingPast && !loadingFuture) {
        if (location.listOffset > -100 && hasMorePostsPast) {
          fetchPostsPast(postsPast.length, { first: 10 })
        } else if (location.bottomOffset < 50 && hasMorePostsFuture && !composerFocusedRef.current) {
          fetchPostsFuture(postsFuture.length, { first: 10 })
        }
      }
    }),
    [hasMorePostsPast, hasMorePostsFuture, loadingPast, loadingFuture]
  )

  const updateLastReadPost = debounce(200, (lastPost) => {
    if (chatView?.id && group?.id && lastPost?.id &&
        parseInt(lastPost.id) > parseInt(lastReadPostIdRef.current || 0)) {
      try {
        lastReadPostIdRef.current = lastPost.id
        dispatch(updateGroupViewUser(chatView.id, { lastReadPostId: lastPost.id }, group.id))
      } catch (error) {
        console.error('Error updating last read post:', error)
      }
    }
  })

  const onRenderedDataChange = useCallback((data) => {
    // Only attempt to update if we have data and a valid lastPost
    if (data && data.length > 0) {
      const lastPost = data[data.length - 1]
      if (lastPost?.id) {
        updateLastReadPost(lastPost)
      }
    }
  }, [chatView?.id, chatView?.lastReadPostId, group?.id])

  // (post.postReactions || []): posts that entered the list optimistically or over
  // the socket carry no reactions array, and throwing here happens AFTER the API
  // call fired — the reaction saved but never showed until a refresh
  const handleAddReaction = useCallback((post, emojiFull) => {
    const optimisticUpdate = { postReactions: [...(post.postReactions || []), { emojiFull, user: { name: currentUser.name, id: currentUser.id } }] }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const handleRemoveReaction = useCallback((post, emojiFull) => {
    const postReactions = (post.postReactions || []).filter(reaction => {
      if (reaction.emojiFull === emojiFull && reaction.user.id === currentUser.id) return false
      return true
    })
    const newPost = { ...post, postReactions }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const handleFlagPost = useCallback(({ post }) => {
    const flaggedGroups = post.flaggedGroups || []
    const optimisticUpdate = { flaggedGroups: [...flaggedGroups, group.id] }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [group?.id])

  // Create a new chat post
  const onCreate = useCallback((postToSave) => {
    const groupId = group?.id || postToSave?.groups?.[0]?.id
    if (!groupId) return false
    // Optimistic add new post, which will be replaced with the real post from the server
    const post = presentPost(postToSave, groupId)
    if (!post) return false
    messageListRef.current?.data.append([post], ({ scrollInProgress, atBottom }) => {
      if (atBottom || scrollInProgress) {
        return 'smooth'
      } else {
        return 'auto'
      }
    })
    return true
  }, [group?.id])

  const afterCreate = useCallback(async (postData) => {
    const groupId = group?.id || postData?.groups?.[0]?.id
    if (!groupId) return
    const post = presentPost(postData, groupId)
    if (!post) return
    // Only match the pending item (requires item.pending) to avoid matching old rehydrated posts
    // that may share the same localId after a page reload (lodash uniqueId resets from 0 each load).
    // Clear localId on the confirmed post so it's never persisted to redux-persist (if we ever bring that back).
    const confirmedPost = { ...post, localId: undefined }
    messageListRef.current?.data.map((item) => item.pending && post.localId && item.localId && post.localId === item.localId ? confirmedPost : item)
    // Sync lastReadPostId locally — update the ref immediately so updateLastReadPost won't fire a redundant
    // network call before the Redux ORM re-render cycle completes. Read state is persisted by the backend
    // on createPost; Redux is updated optimistically in CREATE_POST_PENDING / CREATE_POST.
    if (post.id) {
      lastReadPostIdRef.current = post.id
    }
  }, [group?.id])

  const handleRemovePost = useCallback((postId) => {
    messageListRef.current?.data.findAndDelete((item) => postId === item.id)
  }, [currentUser])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      backButton: false,
      title: t('Chat'),
      headerActions: null,
      icon: <MessageSquareMore className='w-4 h-4' />,
      info: '',
      search: true
    })
  }, [setHeaderDetails, t])

  // ── Resizable chat width ──────────────────────────────────────────────────
  const [chatStreamWidth, setChatStreamWidth] = useState(() => {
    const saved = parseInt(window.localStorage.getItem(CHAT_WIDTH_KEY), 10)
    return Number.isFinite(saved) ? Math.max(saved, MIN_CHAT_WIDTH) : DEFAULT_CHAT_WIDTH
  })
  const [chatPaneEl, setChatPaneEl] = useState(null)
  const [chatPaneWidth, setChatPaneWidth] = useState(0)
  const [resizingChatWidth, setResizingChatWidth] = useState(false)
  const chatResizeDragRef = useRef(null)

  useEffect(() => {
    if (!chatPaneEl) return
    const observer = new ResizeObserver(entries => {
      setChatPaneWidth(entries[0]?.contentRect?.width ?? 0)
    })
    observer.observe(chatPaneEl)
    return () => observer.disconnect()
  }, [chatPaneEl])

  // Widest the stream may grow: the rail hangs fully right of the stream edge,
  // so reserve its width (plus the pane's px-1) instead of a mirrored gutter
  const chatAvailableWidth = Math.max(0, chatPaneWidth - CHAT_GUTTER - CHAT_RAIL_WIDTH - 4)
  const effectiveChatWidth = chatAvailableWidth ? Math.min(chatStreamWidth, chatAvailableWidth) : chatStreamWidth
  // No rail until the pane outgrows the clamp enough for the rail to mean something
  const showChatWidthRail = chatAvailableWidth >= Math.min(chatStreamWidth, DEFAULT_CHAT_WIDTH) + CHAT_RAIL_SLACK

  const onChatRailPointerDown = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    chatResizeDragRef.current = { startX: e.clientX, startWidth: effectiveChatWidth }
    setResizingChatWidth(true)
  }, [effectiveChatWidth])

  const onChatRailPointerMove = useCallback((e) => {
    const drag = chatResizeDragRef.current
    if (!drag) return
    const next = Math.min(Math.max(drag.startWidth + e.clientX - drag.startX, MIN_CHAT_WIDTH), chatAvailableWidth)
    setChatStreamWidth(next)
  }, [chatAvailableWidth])

  const onChatRailPointerUp = useCallback(() => {
    if (!chatResizeDragRef.current) return
    chatResizeDragRef.current = null
    setResizingChatWidth(false)
    setChatStreamWidth(width => {
      window.localStorage.setItem(CHAT_WIDTH_KEY, String(Math.round(width)))
      return width
    })
  }, [])

  return (
    <div className={cn('ChatRoom flex-1 min-h-0 shadow-md flex flex-col overflow-hidden items-center justify-center', { [styles.withoutNav]: withoutNav })} ref={setContainer}>
      <Helmet>
        <title>{t('Chat')} | {group?.name ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>

      <div
        id='chats'
        ref={setChatPaneEl}
        className='my-0 mx-auto min-h-0 w-full flex flex-col flex-1 relative overflow-hidden overflow-x-clip px-1'
        style={{ '--chat-stream-width': `${effectiveChatWidth}px` }}
      >
        {/* The stream header's wash, here as a still strip: theme background fading
            to its own colour at zero alpha, so messages scroll under a soft top edge */}
        <div aria-hidden='true' className='absolute top-0 left-0 right-0 h-14 z-20 pointer-events-none bg-gradient-to-b from-[hsl(var(--theme-background)/0.1)] dark:from-[hsl(var(--theme-background)/0.5)] to-[hsl(var(--theme-background)/0)]' />
        {/* Width rail on the clamp edge. The triangles stay visible as a quiet
            hint; the dashed line and its wash only surface on hover or drag.
            left includes the pane's px-1, which offsets content but not
            absolutely positioned children. */}
        {showChatWidthRail && (
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label={t('Adjust chat width')}
            className={cn(
              'absolute top-0 bottom-0 z-20 flex flex-col items-center justify-between group touch-none select-none',
              resizingChatWidth ? 'cursor-grabbing' : 'cursor-grab'
            )}
            style={{ left: 4 + CHAT_GUTTER + effectiveChatWidth, width: CHAT_RAIL_WIDTH }}
            onPointerDown={onChatRailPointerDown}
            onPointerMove={onChatRailPointerMove}
            onPointerUp={onChatRailPointerUp}
            onPointerCancel={onChatRailPointerUp}
          >
            <div className={cn(
              'absolute inset-0 rounded-lg transition-colors',
              resizingChatWidth ? 'bg-[hsl(var(--theme-background)/0.2)]' : 'group-hover:bg-[hsl(var(--theme-background)/0.2)]'
            )}
            />
            <div className={cn(
              'absolute top-[9px] bottom-[9px] left-1/2 -ml-px border-l-2 border-dashed transition-colors',
              resizingChatWidth ? 'border-foreground/40' : 'border-transparent group-hover:border-foreground/40'
            )}
            />
            <div className={cn(
              'relative w-0 h-0 border-x-4 border-x-transparent border-t-[6px] transition-colors',
              resizingChatWidth ? 'border-t-foreground/60' : 'border-t-foreground/30 group-hover:border-t-foreground/60'
            )}
            />
            <div className={cn(
              'relative w-0 h-0 border-x-4 border-x-transparent border-b-[6px] transition-colors',
              resizingChatWidth ? 'border-b-foreground/60' : 'border-b-foreground/30 group-hover:border-b-foreground/60'
            )}
            />
          </div>
        )}
        {/* Member pill + active strip + slide-in list; absolute inside this container
            so the cover blankets the chat pane and nothing else */}
        <ChatMembersPanel group={group} latestPost={postsForDisplay[postsForDisplay.length - 1]} />
        {initialPostToScrollTo === null || groupLoading || chatViewLoading
          ? (
            <div className='h-full w-full mt-auto overflow-x-visible flex flex-col justify-end min-h-[40vh]'>
              <StreamSkeleton columnVariant='chat' />
            </div>
            )
          : (
            <VirtuosoMessageListLicense licenseKey={import.meta.env.VITE_VIRTUOSO_KEY}>
              <VirtuosoMessageList
                style={{ height: '100%', width: '100%', marginTop: 'auto', overflowX: 'visible' }}
                className='px-3 sm:px-5'
                ref={messageListRef}
                context={{
                  currentUser,
                  group,
                  hasFetchedForCurrentRoom,
                  initialAnimationComplete,
                  latestOldPostId,
                  loadedFuture,
                  loadedPast,
                  loadingFuture,
                  loadingPast,
                  newPostCount: chatView?.newPostCount,
                  numPosts: postsForDisplay.length,
                  handleAddReaction,
                  handleFlagPost,
                  handleRemovePost,
                  handleRemoveReaction,
                  loadToLatest,
                  postIdToStartAt,
                  selectedPostId,
                  showHomeWelcome
                }}
                initialData={postsForDisplay}
                initialLocation={{ index: initialPostToScrollTo, align: 'start-no-overflow' }}
                shortSizeAlign='bottom-smooth'
                computeItemKey={({ data, index }) => data?.id ?? data?.localId ?? `chat-${chatView?.id ?? groupSlug}-${index}`}
                onScroll={onScroll}
                onRenderedDataChange={onRenderedDataChange}
                EmptyPlaceholder={EmptyPlaceholder}
                Footer={Footer}
                Header={Header}
                StickyFooter={StickyFooter}
                ItemContent={ItemContent}
              />
            </VirtuosoMessageListLicense>
            )}
      </div>

      {/* Post chat box */}
      {/* pt below sm gives the last message breathing room above the composer —
          OUTSIDE the message list: padding inside its scroller skews Virtuoso's
          atBottom check, which pinned the phone one message shy of the bottom */}
      <PeopleTyping groupId={group?.id} className='w-full px-3 sm:px-5 pt-2 sm:pt-0 text-xs text-foreground/50' />
      {/* Composer floats with margins matching the message gutter (left edge = avatar edge).
          Subtle gradient settles the pane into a darker hue beneath the input. */}
      <div className='ChatBoxContainer w-full shrink-0 px-3 sm:px-5 pb-3 sm:pb-5 pt-0 bg-gradient-to-b from-transparent to-darkening/[0.05] dark:to-darkening/25'>
        {/* Drafts are scoped per chat topic so switching rooms does not leak text */}
        {group?.id && (
          <ChatEditor
            context='groups'
            autoFocus={!isMobile.any}
            onSave={onCreate}
            afterSave={afterCreate}
            onComposerFocus={() => { composerFocusedRef.current = true }}
            onComposerBlur={() => { composerFocusedRef.current = false }}
          />
        )}
      </div>
      {/* DEPRECATED: Now always show PostDialog routes */}
      {/* {!isWebView() && ( */}
      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>
      {/* )} */}
    </div>
  )
}

/** * Virtuoso Components ***/
const EmptyPlaceholder = ({ context }) => {
  const { t } = useTranslation()
  return (
    <div className='mx-auto flex flex-col items-center justify-center max-w-[750px] h-full min-h-[50vh]'>
      {!context.loadedPast || !context.loadedFuture || !context.hasFetchedForCurrentRoom
        ? <StreamSkeleton columnVariant='chat' />
        : context.showHomeWelcome && context.numPosts === 0
          ? <HomeChatWelcome group={context.group} />
          : <NoPosts className={styles.noPosts} icon='message-dashed' message={t('No messages yet. Start the conversation!')} />}
    </div>
  )
}

const Header = ({ context }) => {
  return context.loadingPast ? <div className='absolute top-1 flex items-center justify-center w-full h-[30px]'><Loading /></div> : null
}

const Footer = ({ context }) => {
  return context.loadingFuture ? <div className={styles.loadingContainerBottom}><Loading /></div> : null
}

const StickyFooter = ({ context }) => {
  const location = useVirtuosoLocation()
  const virtuosoMethods = useVirtuosoMethods()
  // Only once the bottom sits well below the fold. A just-arrived message dips
  // below the fold for a beat before the list auto-scrolls to it — this distance
  // comfortably exceeds that dip, so the button cannot flash during the settle.
  // The unread count alone no longer forces the button: near the bottom the
  // auto-scroll is already taking you there.
  const JUMP_VISIBLE_BELOW_FOLD_PX = 400
  const showJumpButton = location.bottomOffset > JUMP_VISIBLE_BELOW_FOLD_PX
  const showLoadingPulse = context.loadingFuture

  if (!showJumpButton && !showLoadingPulse) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 50
      }}
    >
      <div className='w-8 flex flex-col items-center gap-2'>
        {showLoadingPulse && (
          <div className='h-8 w-8 pointer-events-none rounded-full border border-foreground/10 bg-background/90 shadow-sm animate-pulse flex items-center justify-center' aria-hidden>
            <div className='flex items-center gap-1'>
              <div className='h-1.5 w-1.5 rounded-full bg-foreground/25' />
              <div className='h-1.5 w-1.5 rounded-full bg-foreground/35' />
              <div className='h-1.5 w-1.5 rounded-full bg-foreground/25' />
            </div>
          </div>
        )}
        {showJumpButton && (
          <button
            className='relative flex items-center justify-center bg-background border-2 border-foreground/15 rounded-full w-8 h-8 text-foreground/50 hover:text-foreground'
            onClick={() => {
              // Ensure the newest posts are loaded before scrolling
              Promise.resolve(context.loadToLatest?.())
                .then(() => {
                  virtuosoMethods.scrollToItem({ index: 'LAST', align: 'end', behavior: 'auto' })
                })
            }}
            data-tooltip-content='Jump to latest post'
            data-tooltip-id='jump-to-bottom-tt'
          >
            <ChevronDown className='w-8 h-8' />
            {context.newPostCount && context.newPostCount > 0
              ? (
                <div className='absolute -top-4 min-w-6 min-h-6 text-white bg-accent rounded-full p-1 text-xs text-center'>{context.newPostCount}</div>
                )
              : null}
          </button>
        )}
        {showJumpButton && (
          <Tooltip
            delay={250}
            id='jump-to-bottom-tt'
          />
        )}
      </div>
    </div>
  )
}

const ItemContent = ({ data: post, context, prevData, nextData, index }) => {
  const {
    handleAddReaction,
    handleFlagPost,
    handleRemovePost,
    handleRemoveReaction
  } = context
  const { t } = useTranslation()
  if (!post) return null
  if (post.type === 'chat_activity') return null
  const expanded = context.selectedPostId === post.id
  const highlighted = post.id && context.postIdToStartAt === post.id
  const firstUnread = context.latestOldPostId === prevData?.id && post.creator.id !== context.currentUser.id
  const previousDay = prevData?.createdAt ? DateTimeHelpers.toDateTime(prevData.createdAt, { locale: getLocaleFromLocalStorage() }) : DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage())
  const currentDay = DateTimeHelpers.toDateTime(post.createdAt, { locale: getLocaleFromLocalStorage() })
  const displayDay = prevData?.createdAt && previousDay.hasSame(currentDay, 'day') ? null : getDisplayDay(currentDay)
  const createdTimeDiff = currentDay.diff(previousDay, 'minutes')?.toObject().minutes || 1000
  /* Display the author header if
  * There was no previous post
  * Or this post is the first unread post
  * Or this post is from a different day than the last post
  * Or it's been more than 5 minutes since the last post
  * Or the last post was a different author
  * Or the last post had any comments on it
  * Or the last past was a non chat type post
  */
  const showHeader = !prevData || firstUnread || !!displayDay || createdTimeDiff > MAX_MINS_TO_BATCH || prevData.creator.id !== post.creator.id || prevData.commentersTotal > 0 || prevData.type !== 'chat'
  // Only calculate delay for initial load near bottom
  const isInitialLoad = context.numPosts > 0 && index > context.numPosts - 20
  const delay = isInitialLoad ? Math.min((context.numPosts - index - 1) * 35, 2000) : 0

  // Only animate during initial load, never animate after initial animation is complete
  const shouldAnimate = !post.pending && !context.initialAnimationComplete && isInitialLoad
  const animationClass = shouldAnimate ? 'animate-slide-up invisible' : ''
  const animationStyle = shouldAnimate ? { '--delay': `${delay}ms` } : {}

  return (
    <>
      {/* Same shape as the day divider below, in the notification bubble's accent.
          Arbitrary value for the rule: accent has no <alpha-value> placeholder, so
          slash-opacity classes on it are silently ignored */}
      {firstUnread &&
        <div className='w-full flex items-center my-3'>
          <div className='text-accent text-xs font-semibold whitespace-nowrap'>{t('New posts')}</div>
          <div className='grow ml-4 border-t border-dashed border-[hsl(var(--accent)/0.3)]' />
        </div>}
      {displayDay && (
        <div className='w-full flex items-center my-3'>
          <div className='text-foreground/40 text-xs whitespace-nowrap'>{displayDay}</div>
          <div className='grow ml-4 border-t border-dashed border-foreground/10' />
        </div>
      )}
      {post.type === 'chat'
        ? (
          // Last message keeps a gap above the composer equal to the list's left
          // gutter (px-3 sm:px-5). Keyed on !nextData, not numPosts — appended
          // posts (socket / optimistic send) grow the Virtuoso list before
          // context.numPosts catches up, which left the newest message flush
          // against the bottom.
          <div
            className={cn('max-w-[var(--chat-stream-width,750px)] transition-all mb-0', animationClass, { 'mb-3 sm:mb-5': !nextData })}
            style={animationStyle}
          >
            <ChatPost
              expanded={expanded}
              group={context.group}
              highlighted={highlighted}
              showHeader={showHeader}
              post={post}
              onAddReaction={handleAddReaction}
              onFlagPost={handleFlagPost}
              onRemoveReaction={handleRemoveReaction}
              onRemovePost={handleRemovePost}
            />
          </div>)
        : (
          <div
            className={cn('max-w-[var(--chat-stream-width,750px)] my-2', animationClass, { 'mb-3 sm:mb-5': !nextData })}
            style={animationStyle}
          >
            <ChatPostNotice
              highlighted={highlighted}
              post={post}
            />
          </div>
          )}
    </>
  )
}

const HomeChatWelcome = ({ group }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))

  return (
    <div className='mx-auto px-4 max-w-[500px] flex flex-col items-center justify-center'>
      <img src='/home-chat-welcome.png' alt='Golden Starburst' />
      <h1 className='text-center'>{t('homeChatWelcomeTitle')}</h1>
      <p className='text-center'>{t('homeChatWelcomeDescription', { group_name: group.name })}</p>
      <div className='flex gap-2 items-center justify-center'>
        {canAddMembers && (
          <>
            <Button onClick={() => navigate(groupUrl(group.slug, 'settings/invite'))}><Send /> {t('Send Invites')}</Button>
            <CopyToClipboard text={groupInviteUrl(group)}>
              <Button><Copy /> {t('Copy Invite Link')}</Button>
            </CopyToClipboard>
          </>
        )}
      </div>
    </div>
  )
}
