import isMobile from 'ismobilejs'
import { debounce, includes, isEmpty } from 'lodash/fp'
import { Bell, BellDot, BellMinus, BellOff, ChevronDown, Copy, Send } from 'lucide-react'
import { DateTimeHelpers } from '@hylo/shared'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useLocation, Routes, Route, useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { VirtuosoMessageList, VirtuosoMessageListLicense, useCurrentlyRenderedData, useVirtuosoLocation, useVirtuosoMethods } from '@virtuoso.dev/message-list'

import { getSocket } from 'client/websockets.js'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import PostEditor from 'components/PostEditor/PostEditor'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import Tooltip from 'components/Tooltip'
import Button from 'components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from '@/components/ui/select'
import ChatPost from './ChatPost'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchPosts from 'store/actions/fetchPosts'
import fetchTopicFollow from 'store/actions/fetchTopicFollow'
import updateTopicFollow from 'store/actions/updateTopicFollow'
import { FETCH_TOPIC_FOLLOW, FETCH_POSTS, RESP_ADD_MEMBERS } from 'store/constants'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import orm from 'store/models'
import { DEFAULT_CHAT_TOPIC } from 'store/models/Group'
import presentPost from 'store/presenters/presentPost'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPostResults } from 'store/selectors/getPosts'
import getTopicFollowForCurrentRoute from 'store/selectors/getTopicFollowForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import { cn } from 'util/index'
import { groupInviteUrl, groupUrl } from '@hylo/navigation'
import isWebView from 'util/webView'
import { getLocaleFromLocalStorage } from 'util/locale'

import styles from './ChatRoom.module.scss'

// the maximum amount of time in minutes that can pass between messages to still
// include them under the same avatar and timestamp
const MAX_MINS_TO_BATCH = 5

const getPosts = ormCreateSelector(
  orm,
  getPostResults,
  (session, results) => {
    if (isEmpty(results)) return null
    if (isEmpty(results.ids)) return []
    return session.Post.all()
      .filter(x => includes(x.id, results.ids))
      .orderBy(p => Number(p.id))
      .toModelArray()
      .map(p => presentPost(p))
  }
)

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

// Hack to fix focusing on editor after it unmounts/remounts
EditorView.prototype.updateState = function updateState (state) {
  if (!this.docView) return // This prevents the matchesNode error on hot reloads
  this.updateStateInner(state, this.state.plugins !== state.plugins)
}

// Define icon components as functions that accept props
const NotificationsIcon = React.forwardRef(({ type, ...props }, ref) => {
  const { t } = useTranslation()

  switch (type) {
    case 'all':
      return <Bell {...props} data-tooltip-id='notifications-tt' data-tooltip-content={t('You will receive notifications for all chats in this room.')} />
    case 'important':
      return <BellDot {...props} data-tooltip-id='notifications-tt' data-tooltip-content={t('You will receive notifications for announcements and mentions in this room.')} />
    case 'none':
      return <BellOff {...props} data-tooltip-id='notifications-tt' data-tooltip-content={t('You will not receive notifications for any chats in this room.')} />
    default:
      return <BellMinus {...props} data-tooltip-id='notifications-tt' data-tooltip-html={t('You are previewing this chat room. <br /> Add a chat or change your notification settings to subscribe to this room.')} />
  }
})

const getDisplayDay = (date) => {
  return date.hasSame(DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()), 'day')
    ? 'Today'
    : date.hasSame(DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).minus({ days: 1 }), 'day')
      ? 'Yesterday'
      : date.toFormat('MMM dd, yyyy')
}

export default function ChatRoom (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const location = useLocation()
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout

  const { context } = props
  const { groupSlug, topicName, postId: selectedPostId } = routeParams

  const socket = useMemo(() => getSocket(), [])

  const currentUser = useSelector(getMe)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const topicFollow = useSelector(state => getTopicFollowForCurrentRoute(state, group?.id, topicName))
  const topicFollowLoading = useSelector(state => isPendingFor([FETCH_TOPIC_FOLLOW], state))
  const querystringParams = getQuerystringParam(['search', 'postId'], location)
  const search = querystringParams?.search
  const [postIdToStartAt, setPostIdToStartAt] = useState(querystringParams?.postId)

  const [container, setContainer] = React.useState(null)
  const messageListRef = useRef(null)

  // The last post seen by the current user. Doesn't update in real time as they scroll only when room is reloaded
  const [latestOldPostId, setLatestOldPostId] = useState(topicFollow?.lastReadPostId)

  const [notificationsSetting, setNotificationsSetting] = useState(topicFollow?.settings?.notifications)

  // Whether we are currently loading more past posts or future posts
  const [loadingPast, setLoadingPast] = useState(false)
  const [loadingFuture, setLoadingFuture] = useState(false)
  const [loadedPast, setLoadedPast] = useState(false)
  const [loadedFuture, setLoadedFuture] = useState(false)
  const [initialPostToScrollTo, setInitialPostToScrollTo] = useState(null)

  // Add this new state to track if initial animation is complete
  const [initialAnimationComplete, setInitialAnimationComplete] = useState(false)

  // The number of posts that should fill a screen plus a few more to make sure we have enough posts to scroll through
  const INITIAL_POSTS_TO_LOAD = isWebView() || isMobile.any ? 18 : 30

  const fetchPostsPastParams = useMemo(() => ({
    childPostInclusion: 'no',
    context,
    cursor: postIdToStartAt ? parseInt(postIdToStartAt) + 1 : parseInt(topicFollow?.lastReadPostId) + 1, // -1 because we want the lastread post id included
    filter: 'chat',
    first: Math.max(INITIAL_POSTS_TO_LOAD - topicFollow?.newPostCount, 3), // Always load at least 3 past posts
    order: 'desc',
    slug: groupSlug,
    search,
    sortBy: 'id',
    topic: topicFollow?.topic.id
  }), [context, postIdToStartAt, topicFollow?.lastReadPostId, groupSlug, search, topicFollow?.topic.id])

  const fetchPostsFutureParams = useMemo(() => ({
    childPostInclusion: 'no',
    context,
    cursor: postIdToStartAt || topicFollow?.lastReadPostId,
    filter: 'chat',
    first: Math.min(INITIAL_POSTS_TO_LOAD, topicFollow?.newPostCount),
    order: 'asc',
    slug: groupSlug,
    search,
    sortBy: 'id',
    topic: topicFollow?.topic.id
  }), [context, postIdToStartAt, topicFollow?.lastReadPostId, groupSlug, search, topicFollow?.topic.id])

  const postsPast = useSelector(state => getPosts(state, fetchPostsPastParams))
  const hasMorePostsPast = useSelector(state => getHasMorePosts(state, fetchPostsPastParams))

  const postsFuture = useSelector(state => getPosts(state, fetchPostsFutureParams))
  const hasMorePostsFuture = useSelector(state => getHasMorePosts(state, fetchPostsFutureParams))

  const postsForDisplay = useMemo(() => {
    if (!postsPast && !postsFuture) return []
    return (postsPast || []).concat(postsFuture || [])
  }, [postsPast, postsFuture])

  const fetchPostsPast = useCallback((offset, extraParams = {}, force = false) => {
    if ((loadingPast || hasMorePostsPast === false) && !force) return Promise.resolve()
    setLoadingPast(true)
    return dispatch(fetchPosts({ ...fetchPostsPastParams, offset, ...extraParams }))
      .then((action) => {
        const posts = action.payload?.data?.group?.posts?.items || []
        const newPosts = posts.map(p => presentPost(p, group.id))
        // Always reset loading state
        setLoadingPast(false)
        if (posts?.length > 0) {
          messageListRef.current?.data.prepend(newPosts.reverse())
        }
      })
      .catch(() => setLoadingPast(false))
  }, [fetchPostsPastParams, loadingPast, hasMorePostsPast])

  const fetchPostsFuture = useCallback((offset, extraParams = {}, force = false) => {
    if ((loadingFuture || hasMorePostsFuture === false) && !force) return Promise.resolve()
    setLoadingFuture(true)
    return dispatch(fetchPosts({ ...fetchPostsFutureParams, offset, ...extraParams })).then((action) => {
      setLoadingFuture(false)
      const newPosts = action.payload?.data?.group?.posts?.items.map(p => presentPost(p, group.id)) || []
      if (offset === 0) {
        messageListRef.current?.data.append(newPosts || [], { index: 'LAST', align: 'end' })
      } else {
        messageListRef.current?.data.append(newPosts || [])
      }
      return newPosts.length
    })
  }, [fetchPostsFutureParams, loadingFuture, hasMorePostsFuture])

  const loadToLatest = useCallback(async () => {
    // If there are many new posts, reset to newest using the existing reset flow
    if ((topicFollow?.newPostCount || 0) >= INITIAL_POSTS_TO_LOAD * 2) {
      // Set a huge postId to trigger the reset effect to fetch around the newest posts
      dispatch(changeQuerystringParam(location, 'postId', String(Number.MAX_SAFE_INTEGER), null, true))
      return
    }

    let offset = (postsFuture && postsFuture.length) ? postsFuture.length : 0
    // Incrementally fetch remaining future pages
    while (true) {
      const fetched = await fetchPostsFuture(offset, { first: INITIAL_POSTS_TO_LOAD }, true)
      if (!fetched || fetched < INITIAL_POSTS_TO_LOAD) break
      offset += fetched
    }
  }, [dispatch, location, topicFollow?.newPostCount, fetchPostsFuture, postsFuture?.length])

  const handleNewPostReceived = useCallback((data) => {
    if (!data.topics?.find(t => t.name === topicName)) return
    const post = presentPost(data, group.id)

    let updateExisting = false
    messageListRef.current?.data.map((item) => {
      if (item.pending && (post.id === item.id || (post.localId && post.localId === item.localId))) {
        updateExisting = true
        return post
      } else {
        return item
      }
    })

    if (!updateExisting) {
      messageListRef.current?.data.append(
        [post],
        ({ atBottom, scrollInProgress }) => {
          if (atBottom || scrollInProgress) {
            return 'smooth'
          } else {
            // setUnseenMessages((val) => val + 1) TODO
            return false
          }
        })
    }
  }, [topicName])

  const resetInitialPostToScrollTo = useCallback(() => {
    if (loadedPast && loadedFuture) {
      // Set initial scroll to the passed in post to scroll to, otherwise to the last read post
      const postToScrollTo = postIdToStartAt || topicFollow?.lastReadPostId
      if (!postToScrollTo || postsForDisplay.length === 0) {
        setInitialPostToScrollTo(0)
      } else if (postToScrollTo > postsForDisplay[postsForDisplay.length - 1].id) {
        // XXX: We set the lastReadPostId to the largest post id as a hack to bring people to the most recent post when they join a chat room
        setInitialPostToScrollTo(postsForDisplay.length - 1)
      } else {
        const postToScrollToIndex = postsForDisplay.findIndex(post => post.id === postToScrollTo)
        if (postToScrollToIndex !== -1) {
          // Scroll to one before the post to scroll to, so the post is at the top of the screen and we can see one post of context
          setInitialPostToScrollTo(Math.max(postToScrollToIndex - 1, 0))
        } else {
          // XXX: When joining a room we set the lastReadPostId to the largest post id in the database as a hack to bring people to the most recent post when they join a chat room
          // But more posts could have been added since we did this, so we if we can't find the last read post id, we scroll to the most recent post
          setInitialPostToScrollTo(postsForDisplay.length - 1)
        }
      }
    } else {
      setInitialPostToScrollTo(null)
    }
  }, [loadedPast, loadedFuture, postsForDisplay, postIdToStartAt])

  useEffect(() => {
    // Load TopicFollow
    dispatch(fetchTopicFollow(group?.id, topicName))
  }, [group?.id, topicName])

  useEffect(() => {
    socket.on('newPost', handleNewPostReceived)

    return () => {
      socket.off('newPost', handleNewPostReceived)
    }
  }, [topicName])

  useEffect(() => {
    // New chat room loaded, reset everything
    if (topicFollow?.id) {
      setLoadedFuture(false)
      setNotificationsSetting(topicFollow?.settings?.notifications)

      messageListRef.current?.data.replace([], {
        purgeItemSizes: true
      })

      if (topicFollow.newPostCount > 0) {
        fetchPostsFuture(0).then(() => setLoadedFuture(true))
      } else {
        setLoadedFuture(true)
      }

      if (topicFollow.lastReadPostId) {
        setLoadedPast(false)
        fetchPostsPast(0).then(() => setLoadedPast(true))
      } else {
        setLoadedPast(true)
      }

      resetInitialPostToScrollTo()

      // Reset marker of new posts
      setLatestOldPostId(topicFollow.lastReadPostId)
    }
  }, [topicFollow?.id])

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

  useEffect(() => {
    if (querystringParams?.postId) {
      setPostIdToStartAt(querystringParams?.postId)
      const index = messageListRef.current?.data.findIndex(post => post.id === querystringParams?.postId)
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
          fetchPostsFuture(0, { cursor: querystringParams?.postId, first: INITIAL_POSTS_TO_LOAD }, true)
            .then(() => setLoadedFuture(true)),
          fetchPostsPast(0, { cursor: parseInt(querystringParams?.postId) + 1, first: INITIAL_POSTS_TO_LOAD }, true)
            .then(() => setLoadedPast(true))
        ])
      }

      // Remove the scroll to post from the url so we can click on a notification to scroll to it again
      dispatch(changeQuerystringParam(location, 'postId', null, null, true))
    }
  }, [querystringParams?.postId])

  const onScroll = useMemo(
    () => debounce(200, (location) => {
      if (!loadingPast && !loadingFuture) {
        if (location.listOffset > -100 && hasMorePostsPast) {
          fetchPostsPast(postsPast.length, { first: 10 })
        } else if (location.bottomOffset < 50 && hasMorePostsFuture) {
          fetchPostsFuture(postsFuture.length, { first: 10 })
        }
      }
    }),
    [hasMorePostsPast, hasMorePostsFuture, loadingPast, loadingFuture]
  )

  // TODO: don't know why we need a debounce of 900. there is a bug where we update last read right after creating post and it errors out on backend.
  //   so we have to wait longer befoer doing it. maybe we get the new post back with an id before its really committed to the db?
  const updateLastReadPost = debounce(200, (lastPost) => {
    // Add additional checks to ensure all required values exist
    if (topicFollow?.id && lastPost?.id &&
        (!topicFollow?.lastReadPostId ||
        (parseInt(lastPost.id) > parseInt(topicFollow?.lastReadPostId)))) {
      try {
        dispatch(updateTopicFollow(topicFollow.id, { lastReadPostId: lastPost.id }))
      } catch (error) {
        console.error('Error updating last read post:', error)
      }
    }
  })

  const updateNotificationsSetting = useCallback((value) => {
    setNotificationsSetting(value)
    dispatch(updateTopicFollow(topicFollow?.id, { settings: { notifications: value } }))
  }, [topicFollow?.id])

  const onRenderedDataChange = useCallback((data) => {
    // Only attempt to update if we have data and a valid lastPost
    if (data && data.length > 0) {
      const lastPost = data[data.length - 1]
      if (lastPost.id) {
        updateLastReadPost(lastPost)
      }
    }
  }, [topicFollow?.id, topicFollow?.lastReadPostId])

  const onAddReaction = useCallback((post, emojiFull) => {
    const optimisticUpdate = { postReactions: [...post.postReactions, { emojiFull, user: { name: currentUser.name, id: currentUser.id } }] }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const onRemoveReaction = useCallback((post, emojiFull) => {
    const postReactions = post.postReactions.filter(reaction => {
      if (reaction.emojiFull === emojiFull && reaction.user.id === currentUser.id) return false
      return true
    })
    const newPost = { ...post, postReactions: postReactions.filter(reaction => reaction.emojiFull !== emojiFull || reaction.user.id !== currentUser.id) }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const onFlagPost = useCallback(({ post }) => {
    const flaggedGroups = post.flaggedGroups || []
    const optimisticUpdate = { flaggedGroups: [...flaggedGroups, group.id] }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [group?.id])

  const onAddProposalVote = useCallback(({ post, optionId }) => {
    const optimisticUpdate = {
      proposalVotes: {
        ...post.proposalVotes,
        items: [
          ...post.proposalVotes.items,
          {
            postId: post.id,
            optionId,
            user: currentUser
          }
        ]
      }
    }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const onRemoveProposalVote = useCallback(({ post, optionId }) => {
    const voteIndex = post.proposalVotes.items.findIndex(vote =>
      vote?.user?.id === currentUser.id && vote.optionId === optionId)

    if (voteIndex === -1) return

    const newProposalVotes = [...post.proposalVotes.items]
    newProposalVotes.splice(voteIndex, 1)

    const optimisticUpdate = {
      proposalVotes: {
        ...post.proposalVotes,
        items: newProposalVotes
      }
    }

    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const onSwapProposalVote = useCallback(({ post, addOptionId, removeOptionId }) => {
    const voteIndex = post.proposalVotes.items.findIndex(vote =>
      vote?.user?.id === currentUser.id && vote.optionId === removeOptionId)

    if (voteIndex === -1) return

    const newProposalVotes = [...post.proposalVotes.items]
    newProposalVotes[voteIndex] = {
      postId: post.id,
      optionId: addOptionId,
      user: currentUser
    }

    const optimisticUpdate = {
      proposalVotes: {
        ...post.proposalVotes,
        items: newProposalVotes
      }
    }

    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  // Create a new chat post
  const onCreate = useCallback((postToSave) => {
    // Optimistic add new post, which will be replaced with the real post from the server
    const post = presentPost(postToSave, group.id)
    messageListRef.current?.data.append([post], ({ scrollInProgress, atBottom }) => {
      if (atBottom || scrollInProgress) {
        return 'smooth'
      } else {
        return 'auto'
      }
    })
    return true
  }, [])

  const afterCreate = useCallback(async (postData) => {
    const post = presentPost(postData, group.id)
    messageListRef.current?.data.map((item) => post.localId && item.localId && post.localId === item.localId ? post : item)
    // TODO: probably dont need this, backend should set last_read_post on the chat room when a chat is created
    updateLastReadPost(post)
    if (!notificationsSetting) {
      // If the user has not set a notification setting for this chat room, we set it to all on the backend when creating a post so update the UI to match
      setNotificationsSetting('all')
    }
  }, [notificationsSetting])

  const onRemovePost = useCallback((postId) => {
    messageListRef.current?.data.findAndDelete((item) => postId === item.id)
  }, [currentUser])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: (
        <span className='flex items-center gap-2'>
          #{topicName}
          <Select value={notificationsSetting} onValueChange={updateNotificationsSetting}>
            <SelectTrigger
              icon={<NotificationsIcon type={notificationsSetting} className='w-8 h-8 p-1 rounded-lg cursor-pointer border-2 border-foreground/20 transition-all duration-200 hover:border-foreground/100' />}
              className='border-none p-0 focus:ring-0 focus:ring-offset-0 bg-transparent'
            />
            <SelectContent className='border-none'>
              <SelectItem value='all'>All Chats</SelectItem>
              <SelectItem value='important'>Only Announcements & Mentions</SelectItem>
              <SelectItem value='none'>Mute this chat room</SelectItem>
            </SelectContent>
          </Select>
          <Tooltip
            delay={250}
            place='bottom-start'
            id='notifications-tt'
          />
        </span>
      ),
      icon: null,
      info: '',
      search: !isWebView()
    })
  }, [topicName, notificationsSetting])

  return (
    <div className={cn('h-full shadow-md flex flex-col overflow-hidden items-center justify-center px-1', { [styles.withoutNav]: withoutNav })} ref={setContainer}>
      <Helmet>
        <title>#{topicName} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>

      <div id='chats' className='my-0 mx-auto h-[calc(100%-130px)] w-full flex flex-col flex-1 relative overflow-hidden'>
        {initialPostToScrollTo === null || topicFollowLoading
          ? <div style={{ height: '100%', width: '100%', marginTop: 'auto', overflowX: 'hidden' }}><Loading /></div>
          : (
            <VirtuosoMessageListLicense licenseKey='0cd4e64293a1f6d3ef7a76bbd270d94aTzoyMztFOjE3NjI0NzIyMjgzMzM='>
              <VirtuosoMessageList
                style={{ height: '100%', width: '100%', marginTop: 'auto', overflowX: 'hidden' }}
                ref={messageListRef}
                context={{
                  currentUser,
                  group,
                  initialAnimationComplete,
                  latestOldPostId,
                  loadingFuture,
                  loadingPast,
                  newPostCount: topicFollow?.newPostCount,
                  numPosts: postsForDisplay.length,
                  onAddReaction,
                  onFlagPost,
                  onRemovePost,
                  onRemoveReaction,
                  onAddProposalVote,
                  onRemoveProposalVote,
                  onSwapProposalVote,
                  loadToLatest,
                  postIdToStartAt,
                  selectedPostId,
                  topicName
                }}
                initialData={postsForDisplay}
                initialLocation={{ index: initialPostToScrollTo, align: 'start-no-overflow' }}
                shortSizeAlign='bottom-smooth'
                computeItemKey={({ data }) => data.id || data.localId}
                onScroll={onScroll}
                onRenderedDataChange={onRenderedDataChange}
                EmptyPlaceholder={EmptyPlaceholder}
                Footer={Footer}
                Header={Header}
                StickyHeader={StickyHeader}
                StickyFooter={StickyFooter}
                ItemContent={ItemContent}
              />
            </VirtuosoMessageListLicense>
            )}
      </div>

      {/* Post chat box */}
      <div className='ChatBoxContainer w-full max-w-[750px] border-t-2 border-l-2 border-r-2 border-foreground/10 shadow-xl rounded-t-lg overflow-y-auto'>
        <PostEditor
          context='groups'
          modal={false}
          onSave={onCreate}
          afterSave={afterCreate}
        />
      </div>

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>
    </div>
  )
}

/** * Virtuoso Components ***/
const EmptyPlaceholder = ({ context }) => {
  const { t } = useTranslation()
  return (
    <div className='mx-auto flex flex-col items-center justify-center max-w-[750px] h-full min-h-[50vh]'>
      {context.loadingPast || context.loadingFuture
        ? <Loading />
        : context.topicName === DEFAULT_CHAT_TOPIC && context.numPosts === 0
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

const StickyHeader = ({ data, prevData }) => {
  const firstItem = useCurrentlyRenderedData()[0]
  const createdAt = firstItem?.createdAt ? DateTimeHelpers.toDateTime(firstItem.createdAt, { locale: getLocaleFromLocalStorage() }) : null
  const displayDay = createdAt && getDisplayDay(createdAt)

  return (
    <div className={cn(styles.displayDay, '!absolute top-0')}>
      <div className={cn('absolute right-0 bottom-[15px] text-[11px] text-foreground/50 bg-background/50 hover:bg-background/100 hover:text-foreground/100 rounded-l-[15px] px-[10px] pl-[15px] h-[30px] leading-[30px] min-w-[130px] text-center')}>
        {displayDay}
      </div>
    </div>
  )
}

const StickyFooter = ({ context }) => {
  const location = useVirtuosoLocation()
  const virtuosoMethods = useVirtuosoMethods()
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 50
      }}
    >
      {(location.bottomOffset > 200 || context.newPostCount > 0) && (
        <>
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
          <Tooltip
            delay={250}
            id='jump-to-bottom-tt'
          />
        </>
      )}
    </div>
  )
}

const ItemContent = ({ data: post, context, prevData, nextData, index }) => {
  const { t } = useTranslation()
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
      {firstUnread && !displayDay && <div className={styles.firstUnread}><hr className='border-t-2 border-red-500' /> <span className='text-red-500 text-center w-full block'>{t('New posts')}</span></div>}
      {firstUnread && displayDay &&
        <div className={styles.unreadAndDay}>
          <hr className='border-t-2 border-red-500' />
          <div className='flex w-full items-center my-3'>
            <div className='grow h-px bg-foreground/10' />
            <div className='mx-4 text-foreground/40 text-sm whitespace-nowrap'>{displayDay}</div>
            <div className='grow h-px bg-foreground/10' />
          </div>
        </div>}
      {!firstUnread && displayDay && (
        <div className='w-full flex items-center my-3'>
          <div className='grow h-px bg-foreground/10' />
          <div className='mx-4 text-foreground/40 text-sm whitespace-nowrap'>{displayDay}</div>
          <div className='grow h-px bg-foreground/10' />
        </div>
      )}
      {post.type === 'chat'
        ? (
          <div
            className={cn('mx-auto max-w-[750px] transition-all mb-0', animationClass, { 'mb-5': index === context.numPosts - 1 })}
            style={animationStyle}
          >
            <ChatPost
              expanded={expanded}
              group={context.group}
              highlighted={highlighted}
              showHeader={showHeader}
              post={post}
              onAddReaction={context.onAddReaction}
              onFlagPost={context.onFlagPost}
              onRemoveReaction={context.onRemoveReaction}
              onRemovePost={context.onRemovePost}
            />
          </div>)
        : (
          <div
            className={`mx-auto max-w-[750px] mt-2 ${animationClass}`}
            style={animationStyle}
          >
            <PostCard
              group={context.group}
              expanded={expanded}
              highlighted={highlighted}
              post={post}
              onAddReaction={context.onAddReaction}
              onRemoveReaction={context.onRemoveReaction}
              onRemovePost={context.onRemovePost}
              onAddProposalVote={context.onAddProposalVote}
              onRemoveProposalVote={context.onRemoveProposalVote}
              onSwapProposalVote={context.onSwapProposalVote}
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
