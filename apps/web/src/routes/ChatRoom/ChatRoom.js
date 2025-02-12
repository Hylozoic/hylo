import { debounce, includes, isEmpty, trim, uniqueId } from 'lodash/fp'
import { Bell, BellDot, BellMinus, BellOff, ChevronDown, Copy, Send, SendHorizontal, ImagePlus } from 'lucide-react'
import { DateTime } from 'luxon'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useParams, useLocation, Routes, Route, useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { VirtuosoMessageList, VirtuosoMessageListLicense, useCurrentlyRenderedData, useVirtuosoLocation, useVirtuosoMethods } from '@virtuoso.dev/message-list'

import { getSocket } from 'client/websockets.js'
import AttachmentManager from 'components/AttachmentManager'
import {
  addAttachment,
  clearAttachments,
  getAttachments
} from 'components/AttachmentManager/AttachmentManager.store'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import HyloEditor from 'components/HyloEditor'
import LinkPreview from 'components/PostEditor/LinkPreview'
import {
  FETCH_LINK_PREVIEW,
  pollingFetchLinkPreview,
  removeLinkPreview,
  clearLinkPreview,
  getLinkPreview
} from 'components/PostEditor/PostEditor.store'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import PostCard from 'components/PostCard'
import PostDialog from 'components/PostDialog'
import Tooltip from 'components/Tooltip'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { Button } from 'components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from '@/components/ui/select'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import ChatPost from './ChatPost'
import createPost from 'store/actions/createPost'
import fetchPosts from 'store/actions/fetchPosts'
import fetchTopicFollow from 'store/actions/fetchTopicFollow'
import updateTopicFollow from 'store/actions/updateTopicFollow'
import { FETCH_TOPIC_FOLLOW } from 'store/constants'
import orm from 'store/models'
import { DEFAULT_CHAT_TOPIC } from 'store/models/Group'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPostResults } from 'store/selectors/getPosts'
import getTopicFollowForCurrentRoute from 'store/selectors/getTopicFollowForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import { MAX_POST_TOPICS } from 'util/constants'
import { cn } from 'util/index'
import { groupInviteUrl, groupUrl } from 'util/navigation'
import isWebView from 'util/webView'

import styles from './ChatRoom.module.scss'

// the maximum amount of time in minutes that can pass between messages to still
// include them under the same avatar and timestamp
const MAX_MINS_TO_BATCH = 5

const NUM_POSTS_TO_LOAD = 30

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

// Recommended here:
// https://github.com/ueberdosis/tiptap/issues/2403#issuecomment-1062712162
function useEventCallback (fn) {
  const ref = useRef()
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback(() => (0, ref.current)(), [])
}

// Hack to fix focusing on editor after it unmounts/remounts
EditorView.prototype.updateState = function updateState (state) {
  if (!this.docView) return // This prevents the matchesNode error on hot reloads
  this.updateStateInner(state, this.state.plugins !== state.plugins)
}

// Define icon components as functions that accept props
const NotificationsIcon = ({ type, ...props }) => {
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
}

const getDisplayDay = (date) => {
  return date.hasSame(DateTime.now(), 'day')
    ? 'Today'
    : date.hasSame(DateTime.now().minus({ days: 1 }), 'day')
      ? 'Yesterday'
      : date.toFormat('MMM dd, yyyy')
}

export default function ChatRoom (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const location = useLocation()
  const { t } = useTranslation()
  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout

  const { context } = props
  const { groupSlug, topicName, postId: selectedPostId } = routeParams

  const socket = useMemo(() => getSocket(), [])

  const currentUser = useSelector(getMe)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupIds = useMemo(() => group?.id ? [group.id] : [], [group])
  const topicFollow = useSelector(state => getTopicFollowForCurrentRoute(state, group?.id, topicName))
  const topicFollowLoading = useSelector(state => isPendingFor([FETCH_TOPIC_FOLLOW], state))
  const imageAttachments = useSelector(state => getAttachments(state, { type: 'post', id: 'new', attachmentType: 'image' }), (a, b) => a.length === b.length && a.every((item, index) => item.id === b[index].id))
  const linkPreview = useSelector(getLinkPreview) // TODO: check
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const querystringParams = getQuerystringParam(['search', 'postId'], location)
  const search = querystringParams?.search
  const postIdToStartAt = querystringParams?.postId // TODO: remove from the querystring so pressing back doesn't take you to the same post?

  const [container, setContainer] = React.useState(null)
  const editorRef = useRef()
  const messageListRef = useRef(null)

  // Whether there is an in progress new post draft
  const [postInProgress, setPostInProgress] = useState(false)

  // The last post seen by the current user. Doesn't update in real time as they scroll only when room is reloaded
  const [latestOldPostId, setLatestOldPostId] = useState(topicFollow?.lastReadPostId)

  const [notificationsSetting, setNotificationsSetting] = useState(topicFollow?.settings?.notifications)

  // Whether we are currently loading more past posts or future posts
  const [loadingPast, setLoadingPast] = useState(false)
  const [loadingFuture, setLoadingFuture] = useState(false)
  const [loadedPast, setLoadedPast] = useState(false)
  const [loadedFuture, setLoadedFuture] = useState(false)
  const [initialPostToScrollTo, setInitialPostToScrollTo] = useState(null)

  const emptyPost = useMemo(() => ({
    commenters: [],
    details: '',
    groups: group ? [group] : [],
    linkPreview: null,
    linkPreviewFeatured: false,
    location: '',
    title: null,
    topicNames: [topicName],
    type: 'chat'
  }), [group, topicName])

  // The data for an in progress post draft
  const [newPost, setNewPost] = useState(emptyPost)

  const fetchPostsPastParams = useMemo(() => ({
    childPostInclusion: 'no',
    context,
    cursor: postIdToStartAt ? parseInt(postIdToStartAt) + 1 : parseInt(topicFollow?.lastReadPostId) + 1, // -1 because we want the lastread post id included
    filter: 'chat',
    first: NUM_POSTS_TO_LOAD,
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
    first: NUM_POSTS_TO_LOAD,
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

  const postsForDisplay = useMemo(() => (postsPast || []).concat(postsFuture || []), [postsPast, postsFuture])

  const fetchPostsPast = useCallback((offset) => {
    if (loadingPast || hasMorePostsPast === false) return Promise.resolve()
    setLoadingPast(true)
    return dispatch(fetchPosts({ offset, ...fetchPostsPastParams })).then((action) => {
      messageListRef.current?.data.prepend(action.payload?.data?.group?.posts?.items?.reverse() || [])
      setLoadingPast(false)
    })
  }, [fetchPostsPastParams, loadingPast, hasMorePostsPast])

  const fetchPostsFuture = useCallback((offset) => {
    if (loadingFuture || hasMorePostsFuture === false) return Promise.resolve()
    setLoadingFuture(true)
    return dispatch(fetchPosts({ ...fetchPostsFutureParams, offset })).then((action) => {
      setLoadingFuture(false)
      const newPosts = action.payload?.data?.group?.posts?.items || []
      if (offset === 0) {
        messageListRef.current?.data.replace(newPosts || [], { index: 'LAST', align: 'end' })
      } else {
        messageListRef.current?.data.append(newPosts || [])
      }
    })
  }, [fetchPostsFutureParams, loadingFuture, hasMorePostsFuture])

  const clearImageAttachments = useCallback(() => dispatch(clearAttachments('post', 'new', 'image')), [dispatch])

  const handleNewPostReceived = useCallback((data) => {
    if (!data.topics?.find(t => t.name === topicName)) return

    let updateExisting = false
    messageListRef.current?.data.map((item) => {
      if (item.pending && (data.id === item.id || (data.localId && data.localId === item.localId))) {
        updateExisting = true
        return data
      } else {
        return item
      }
    })

    if (!updateExisting) {
      messageListRef.current?.data.append(
        [data],
        ({ atBottom, scrollInProgress }) => {
          if (atBottom || scrollInProgress) {
            return 'smooth'
          } else {
            // setUnseenMessages((val) => val + 1) TODO
            return false
          }
        })
    }
  }, [])

  const resetInitialPostToScrollTo = useCallback(() => {
    if (loadedPast && loadedFuture) {
      if (!topicFollow?.lastReadPostId) {
        setInitialPostToScrollTo(0)
      } else if (topicFollow?.lastReadPostId > postsForDisplay[postsForDisplay.length - 1].id) {
        // XXX: We set the lastReadPostId to the largest post id as a hack to bring people to the most recent post when they join a chat room
        setInitialPostToScrollTo(postsForDisplay.length - 1)
      } else {
        // Set initial scroll to the last read post
        const lastReadPostIndex = postsForDisplay.findIndex(post => post.id === topicFollow?.lastReadPostId)
        if (lastReadPostIndex !== -1) {
          setInitialPostToScrollTo(lastReadPostIndex)
        } else {
          console.error('Something went wrong, last read post not found in postsPast or postsFuture', topicFollow?.lastReadPostId)
          setInitialPostToScrollTo(null)
        }
      }
    } else {
      setInitialPostToScrollTo(null)
    }
  }, [loadedPast, loadedFuture, postsPast, postsFuture])

  useEffect(() => {
    // New chat room loaded, reset everything
    dispatch(clearLinkPreview())
    clearImageAttachments()
    setNewPost(emptyPost)

    // Load TopicFollow
    dispatch(fetchTopicFollow(group?.id, topicName))
  }, [group?.id, topicName])

  useEffect(() => {
    socket.on('newPost', handleNewPostReceived)

    // On component unmount clear link preview and images attachments from redux
    return () => {
      dispatch(clearLinkPreview())
      clearImageAttachments()
      socket.off('newPost', handleNewPostReceived)
    }
  }, [])

  useEffect(() => {
    // New chat room loaded, reset everything
    if (topicFollow?.id) {
      setLoadedFuture(false)
      setNotificationsSetting(topicFollow?.settings?.notifications)
      fetchPostsFuture(0).then(() => setLoadedFuture(true))

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

    setTimeout(() => {
      // In case we unmounted really quick and its no longer here
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }, 1000)
  }, [topicFollow?.id])

  // Do once after loading posts for the room to get things ready
  useEffect(() => {
    resetInitialPostToScrollTo()
  }, [loadedPast, loadedFuture])

  // When text is entered in a draft post set postInProgress to true
  const handleDetailsUpdate = (d) => {
    const hasText = trim(editorRef.current?.getText() || '').length > 0
    setPostInProgress(hasText)
  }

  // Add a topic to the new post
  const handleAddTopic = topic => {
    if (newPost?.topicNames?.length >= MAX_POST_TOPICS) return
    setNewPost({ ...newPost, topicNames: [...newPost.topicNames, topic.name] })
  }

  // Checks for linkPreview every 1/2 second
  const handleAddLinkPreview = debounce(500, (url, force) => {
    const { linkPreview } = newPost
    if (linkPreview && !force) return
    if (!fetchLinkPreviewPending) {
      pollingFetchLinkPreview(dispatch, url)
    }
  })

  // Have to wait for the link preview to load from the server before adding to the new post
  useEffect(() => {
    setNewPost({ ...newPost, linkPreview })
  }, [linkPreview])

  const handleFeatureLinkPreview = featured => {
    setNewPost({ ...newPost, linkPreviewFeatured: featured })
  }

  const handleRemoveLinkPreview = () => {
    dispatch(removeLinkPreview())
    setNewPost({ ...newPost, linkPreview: null, linkPreviewFeatured: false })
  }

  const onScroll = React.useCallback(
    (location) => {
      if (!loadingPast && !loadingFuture) {
        if (location.listOffset > -100 && hasMorePostsPast) {
          fetchPostsPast(postsPast.length)
        } else if (location.bottomOffset < 50 && hasMorePostsFuture) {
          fetchPostsFuture(postsFuture.length)
        }
      }
    },
    [hasMorePostsPast, hasMorePostsFuture, loadingPast, loadingFuture]
  )

  const updateLastReadPost = debounce(200, (lastPost) => {
    if (topicFollow?.id && lastPost && (!topicFollow?.lastReadPostId || lastPost.id > topicFollow?.lastReadPostId)) {
      dispatch(updateTopicFollow(topicFollow.id, { lastReadPostId: lastPost.id }))
    }
  })

  const updateNotificationsSetting = useCallback((value) => {
    setNotificationsSetting(value)
    dispatch(updateTopicFollow(topicFollow?.id, { settings: { notifications: value } }))
  }, [topicFollow?.id])

  const onRenderedDataChange = useCallback((data) => {
    const lastPost = data[data.length - 1]
    updateLastReadPost(lastPost)
  }, [topicFollow?.id, topicFollow?.lastReadPostId])

  const onAddReaction = useCallback((post, emojiFull) => {
    const optimisticUpdate = { myReactions: [...post.myReactions, { emojiFull }], postReactions: [...post.postReactions, { emojiFull, user: { name: currentUser.name, id: currentUser.id } }] }
    const newPost = { ...post, ...optimisticUpdate }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  const onRemoveReaction = useCallback((post, emojiFull) => {
    const postReactions = post.postReactions.filter(reaction => {
      if (reaction.emojiFull === emojiFull && reaction.user.id === currentUser.id) return false
      return true
    })
    const newPost = { ...post, myReactions: post.myReactions.filter(react => react.emojiFull !== emojiFull), postReactions }
    messageListRef.current?.data.map((item) => post.id === item.id || (post.localId && post.localId === item.localId) ? newPost : item)
  }, [currentUser])

  // Create a new chat post
  const postChatMessage = useEventCallback(async () => {
    // Only submit if any non-whitespace text has been added
    if (trim(editorRef.current?.getText() || '').length === 0) return

    const details = editorRef.current.getHTML()
    const imageUrls = imageAttachments && imageAttachments.map((attachment) => attachment.url)
    const postToSave = {
      ...newPost,
      createdAt: DateTime.now().toISO(),
      creator: currentUser,
      details,
      imageUrls,
      pending: true,
      localId: uniqueId('post_')
    }

    // Optimistic add new post, which will be replaced with the real post from the server
    messageListRef.current?.data.append([postToSave], ({ scrollInProgress, atBottom }) => {
      if (atBottom || scrollInProgress) {
        return 'smooth'
      } else {
        return 'auto'
      }
    })

    // Clear create form instantly to make it feel faster and prevent double submit
    editorRef.current.clearContent()
    dispatch(clearLinkPreview())
    clearImageAttachments()
    setNewPost(emptyPost)
    editorRef.current.focus()

    const action = await dispatch(createPost(postToSave))
    const post = action.payload.data.createPost
    // Update the optimistic post with the real post from the server
    messageListRef.current?.data.map((item) => post.localId && item.localId && post.localId === item.localId ? post : item)
    updateLastReadPost(post)
    if (!notificationsSetting) {
      // If the user has not set a notification setting for this chat room, we set it to all on the backend when creating a post so update the UI to match
      setNotificationsSetting('all')
    }
    return true
  })

  const postsForDisplay = useMemo(() => (postsPast || []).concat(postsFuture || []), [postsPast, postsFuture])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: (
        <span className='flex items-center gap-2'>
          #{topicName}
          <Select value={notificationsSetting} onValueChange={updateNotificationsSetting}>
            <SelectTrigger
              icon={<NotificationsIcon type={notificationsSetting} className='w-8 h-8 p-1 rounded-lg border-2 border-foreground/15 cursor-pointer' />}
              className='border-none p-0 focus:ring-0 focus:ring-offset-0'
            />
            <SelectContent>
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
      icon: 'Message',
      info: '',
      search: true
    })
  }, [topicName, notificationsSetting])

  if (topicFollowLoading) return <Loading />

  return (
    <div className={cn('h-full shadow-md flex flex-col overflow-hidden items-center justify-center', { [styles.withoutNav]: withoutNav })}>
      <Helmet>
        <title>#{topicName} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>

      <div id='chats' className='my-0 mx-auto h-[calc(100%-130px)] w-full flex flex-col flex-1 relative overflow-hidden' ref={setContainer}>
        {initialPostToScrollTo === null
          ? <div className={styles.loadingContainer}><Loading /></div>
          : (
            <VirtuosoMessageListLicense licenseKey='0cd4e64293a1f6d3ef7a76bbd270d94aTzoyMztFOjE3NjI0NzIyMjgzMzM='>
              <VirtuosoMessageList
                style={{ height: '100%', width: '100%', marginTop: 'auto', paddingBottom: '20px' }}
                ref={messageListRef}
                context={{ currentUser, loadingPast, loadingFuture, selectedPostId, group, latestOldPostId, onAddReaction, onRemoveReaction, topicName, numPosts: postsForDisplay.length, newPostCount: topicFollow?.newPostCount }}
                initialData={postsForDisplay}
                initialLocation={{ index: initialPostToScrollTo, align: initialPostToScrollTo === 0 ? 'start' : 'end' }}
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
      <div className='ChatBoxContainer w-full max-w-[750px]'>
        <div className='ChatBox relative w-full px-2 shadow-md p-2 border-2 border-foreground/15 shadow-xlg rounded-t-xl bg-card'>
          <HyloEditor
            contentHTML={newPost.details}
            groupIds={groupIds}
            // Disable edit cancel through escape due to event bubbling issues
            // onEscape={this.handleCancel}
            onAddTopic={handleAddTopic}
            onAddLink={handleAddLinkPreview}
            onUpdate={handleDetailsUpdate}
            onEnter={postChatMessage}
            placeholder={`Send a message to #${topicName}`}
            readOnly={loadingPast || loadingFuture}
            ref={editorRef}
            showMenu={!isWebView()}
            className={cn(styles.editor)}
          />
          {(linkPreview || fetchLinkPreviewPending) && (
            <LinkPreview
              className={styles.linkPreview}
              loading={fetchLinkPreviewPending}
              linkPreview={linkPreview}
              featured={newPost.linkPreviewFeatured}
              onFeatured={handleFeatureLinkPreview}
              onClose={handleRemoveLinkPreview}
            />
          )}
          <div>
            <AttachmentManager
              type='post'
              id='new'
              attachmentType='image'
              showAddButton
              showLabel
              showLoading
            />
            <div className='flex w-full justify-between items-center px-2'>
              <UploadAttachmentButton
                type='post'
                className='w-[20px] h-[20px] opacity-70 hover:opacity-100 transition-all'
                id='new'
                attachmentType='image'
                onSuccess={(attachment) => dispatch(addAttachment('post', 'new', attachment))}
                allowMultiple
              >
                <ImagePlus className={cn('text-foreground hover:cursor-pointer hover:text-accent w-[20px] h-[20px]', { 'text-primary': imageAttachments && imageAttachments.length > 0 })} />
                {/* Remove when it's confirmed to be working
                  <Icon
                    name='AddImage'
                    className={cn('text-foreground', styles.actionIcon, { [styles.highlightIcon]: imageAttachments && imageAttachments.length > 0 })}
                  />
                  */}
              </UploadAttachmentButton>

              <Button
                disabled={!postInProgress}
                onClick={postChatMessage}
                className='bg-foreground/30 px-2 py-1 rounded flex items-center'
              >
                <SendHorizontal className={!postInProgress ? 'text-background' : 'text-highlight'} size={18} style={{ display: 'inline' }} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>
    </div>
  )
}

/** * Virtuoso Components ***/
const EmptyPlaceholder = ({ context }) => {
  return (
    <div className='mx-auto flex flex-col items-center justify-center max-w-[750px] h-full min-h-[50vh]'>
      {context.loadingPast || context.loadingFuture
        ? <Loading />
        : context.topicName === DEFAULT_CHAT_TOPIC && context.numPosts === 0
          ? <HomeChatWelcome group={context.group} />
          : <NoPosts className={styles.noPosts} />}
    </div>
  )
}

const Header = ({ context }) => {
  return context.loadingPast ? <div style={{ height: '30px' }}><Loading /></div> : null
}

const Footer = ({ context }) => {
  return context.loadingFuture ? <div className={styles.loadingContainerBottom}><Loading /></div> : null
}

const StickyHeader = ({ data, prevData }) => {
  const firstItem = useCurrentlyRenderedData()[0]
  const createdAt = firstItem?.createdAt ? DateTime.fromISO(firstItem.createdAt) : null
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
      {location.bottomOffset > 200 && (
        <>
          <button
            className='relative flex items-center justify-center bg-background border-2 border-foreground/15 rounded-full w-8 h-8 text-foreground/50 hover:bg-foreground/10 hover:text-foreground'
            onClick={() => {
              virtuosoMethods.scrollToItem({ index: 'LAST', align: 'end', behavior: 'auto' })
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

const ItemContent = ({ data: post, context, prevData, nextData }) => {
  const expanded = context.selectedPostId === post.id
  const firstUnread = context.latestOldPostId === prevData?.id && post.creator.id !== context.currentUser.id
  const previousDay = prevData?.createdAt ? DateTime.fromISO(prevData.createdAt) : DateTime.now()
  const currentDay = DateTime.fromISO(post.createdAt)
  const displayDay = prevData?.createdAt && previousDay.hasSame(currentDay, 'day') ? null : getDisplayDay(currentDay)
  const createdTimeDiff = Math.abs(currentDay.diff(previousDay, 'minutes'))

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
  return (
    <>
      {firstUnread && !displayDay
        ? (
          <div className={styles.firstUnread}>
            <div className={cn('border-dashed border-b-2 border-background')} />
            <div className={styles.newPost}>NEW</div>
          </div>
          )
        : null}
      {firstUnread && displayDay
        ? (
          <div className={styles.unreadAndDay}>
            <div className={cn('border-dashed border-b-2 border-background')} />
            <div className={styles.newPost}>NEW</div>
            <div className={cn('absolute right-0 bottom-[15px] text-[11px] text-foreground/50 bg-background/50 hover:bg-background/100 hover:text-foreground/100 rounded-l-[15px] px-[10px] pl-[15px] h-[30px] leading-[30px] min-w-[130px] text-center')}>{displayDay}</div>
          </div>
          )
        : null}
      {!firstUnread && displayDay
        ? (
          <div className='w-full flex items-center'>
            <div className={cn('border-dashed border-b-2 border-background/50 w-full')} />
            <div className={cn('uppercase text-[11px] text-foreground/50 bg-background/50 hover:bg-background/100 hover:text-foreground/100 rounded-l-[15px] px-[10px] pl-[15px] h-[30px] leading-[30px] min-w-[130px] text-center')}>{displayDay}</div>
          </div>
          )
        : null}
      {post.type === 'chat'
        ? (
          <div className='mx-auto px-4 max-w-[750px]'>
            <ChatPost
              expanded={expanded}
              group={context.group}
              showHeader={showHeader}
              post={post}
              onAddReaction={context.onAddReaction}
              onRemoveReaction={context.onRemoveReaction}
            />
          </div>
          )
        : (
          <div className='mx-auto px-4 max-w-[750px]'>
            <PostCard
              group={context.group}
              expanded={expanded}
              post={post}
              onAddReaction={context.onAddReaction}
              onRemoveReaction={context.onRemoveReaction}
            />
          </div>
          )}
    </>
  )
}

const HomeChatWelcome = ({ group }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className='mx-auto px-4 max-w-[500px] flex flex-col items-center justify-center'>
      <img src='/home-chat-welcome.png' alt='Golden Starburst' />
      <h1 className='text-center'>{t('homeChatWelcomeTitle')}</h1>
      <p className='text-center'>{t('homeChatWelcomeDescription', { group_name: group.name })}</p>
      <div className='flex gap-2 items-center justify-center'>
        <Button onClick={() => navigate(groupUrl(group.slug, 'settings/invite'))}><Send /> {t('Send Invites')}</Button>
        <CopyToClipboard text={groupInviteUrl(group)}>
          <Button><Copy /> {t('Copy Invite Link')}</Button>
        </CopyToClipboard>
      </div>
    </div>
  )
}
