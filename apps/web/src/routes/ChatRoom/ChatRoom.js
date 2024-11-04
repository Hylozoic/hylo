import cx from 'classnames'
import { debounce, get, includes, isEmpty, trim, uniqueId } from 'lodash/fp'
import moment from 'moment-timezone'
import { EditorView } from 'prosemirror-view'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { IoSend } from 'react-icons/io5'
import { useResizeDetector } from 'react-resize-detector'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { VirtuosoMessageList, VirtuosoMessageListLicense, useCurrentlyRenderedData } from '@virtuoso.dev/message-list'

import { getSocket, socketUrl } from 'client/websockets.js'
import AttachmentManager from 'components/AttachmentManager'
import {
  addAttachment,
  clearAttachments,
  getAttachments
} from 'components/AttachmentManager/AttachmentManager.store'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import Button from 'components/Button'
import HyloEditor from 'components/HyloEditor'
import Icon from 'components/Icon'
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
import TopicFeedHeader from 'components/TopicFeedHeader'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import ChatPost from './ChatPost'
import createPost from 'store/actions/createPost'
import fetchGroupTopic from 'store/actions/fetchGroupTopic'
import fetchPosts from 'store/actions/fetchPosts'
import fetchTopic from 'store/actions/fetchTopic'
import respondToEvent from 'store/actions/respondToEvent'
import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import updateGroupTopicLastReadPost from 'store/actions/updateGroupTopicLastReadPost'
import { FETCH_POSTS, FETCH_TOPIC, FETCH_GROUP_TOPIC } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getGroupTopicForCurrentRoute from 'store/selectors/getGroupTopicForCurrentRoute'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPostResults, getTotalPosts } from 'store/selectors/getPosts'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import { MAX_POST_TOPICS } from 'util/constants'
import { postUrl } from 'util/navigation'
import isWebView from 'util/webView'

import styles from './ChatRoom.module.scss'

// the maximum amount of time in minutes that can pass between messages to still
// include them under the same avatar and timestamp
const MAX_MINS_TO_BATCH = 5

const NUM_POSTS_TO_LOAD = 30

const dayFormats = {
  // when the date is closer, specify custom values
  lastDay: '[Yesterday]',
  sameDay: '[Today]',
  lastWeek: 'MMMM DD, YYYY',
  sameElse: function () {
    return 'MMMM DD, YYYY'
  }
}

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

export default function ChatRoom (props) {
  const dispatch = useDispatch()
  const routeParams = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const { hideNavLayout } = useLayoutFlags()
  const withoutNav = isWebView() || hideNavLayout

  const { context } = props
  const { groupSlug, topicName, postId: selectedPostId } = routeParams

  const socket = useMemo(() => getSocket(), [])

  const currentUser = useSelector(getMe)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupIds = useMemo(() => group?.id ? [group.id] : [], [group])
  const groupTopic = useSelector(state => getGroupTopicForCurrentRoute(state, groupSlug, topicName))
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))
  const topicLoading = useSelector(state => isPendingFor([FETCH_TOPIC, FETCH_GROUP_TOPIC], state))
  const imageAttachments = useSelector(state => getAttachments(state, { type: 'post', id: 'new', attachmentType: 'image' }), shallowEqual)
  const linkPreview = useSelector(getLinkPreview) // TODO: check
  const fetchLinkPreviewPending = useSelector(state => isPendingFor(FETCH_LINK_PREVIEW, state))
  const followersTotal = useMemo(() => get('followersTotal', groupSlug ? groupTopic : topic), [groupSlug, groupTopic, topic])
  const querystringParams = getQuerystringParam(['search', 'postId'], location)
  const search = querystringParams?.search
  const postIdToStartAt = querystringParams?.postId

  const containerRef = useRef()
  const editorRef = useRef()
  const virtuoso = useRef(null)
  const messageListRef = useRef(null)

  // Whether scroll is at the bottom of the chat (most recent post)
  const [atBottom, setAtBottom] = useState(false)

  // Whether the current user has a created a new post in the room yet
  const [createdNewPost, setCreatedNewPost] = useState(false)

  // Whether there is an in progress new post draft
  const [postInProgress, setPostInProgress] = useState(false)

  // The last post seen by the current user. Doesn't update in real time as they scroll only when room is reloaded
  const [latestOldPostId, setLatestOldPostId] = useState(groupTopic?.lastReadPostId)

  // The up to date last read post id, updates in real time as they scroll
  const [lastReadPostId, setLastReadPostId] = useState(groupTopic?.lastReadPostId)

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
    cursor: postIdToStartAt ? parseInt(postIdToStartAt) + 1 : parseInt(groupTopic?.lastReadPostId) + 1, // -1 because we want the lastread post id included
    filter: 'chat',
    first: NUM_POSTS_TO_LOAD,
    order: 'desc',
    slug: groupSlug,
    search,
    sortBy: 'id',
    topic: topic?.id
  }), [context, postIdToStartAt, groupTopic?.lastReadPostId, groupSlug, search, topic?.id])

  const fetchPostsFutureParams = useMemo(() => ({
    childPostInclusion: 'no',
    context,
    cursor: postIdToStartAt || groupTopic?.lastReadPostId,
    filter: 'chat',
    first: NUM_POSTS_TO_LOAD,
    order: 'asc',
    slug: groupSlug,
    search,
    sortBy: 'id',
    topic: topic?.id
  }), [context, postIdToStartAt, groupTopic?.lastReadPostId, groupSlug, search, topic?.id])

  const postsPast = useSelector(state => getPosts(state, fetchPostsPastParams))
  const hasMorePostsPast = useSelector(state => getHasMorePosts(state, fetchPostsPastParams))
  const totalPostsPast = useSelector(state => getTotalPosts(state, fetchPostsPastParams) || 0)

  const postsFuture = useSelector(state => getPosts(state, fetchPostsFutureParams))
  const hasMorePostsFuture = useSelector(state => getHasMorePosts(state, fetchPostsFutureParams))
  const totalPostsFuture = useSelector(state => getTotalPosts(state, fetchPostsFutureParams) || 0)

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
      messageListRef.current?.data.append(action.payload?.data?.group?.posts?.items || [])
    })
  }, [fetchPostsFutureParams, loadingFuture, hasMorePostsFuture])

  const fetchTopicAction = useCallback(() => {
    if (groupSlug && topicName) {
      return dispatch(fetchGroupTopic(topicName, groupSlug))
    } else if (topicName) {
      return dispatch(fetchTopic(topicName))
    }
  }, [dispatch, groupSlug, topicName])

  const clearImageAttachments = useCallback(() => dispatch(clearAttachments('post', 'new', 'image')), [dispatch])

  const respondToEventAction = useCallback((post) => (response) => dispatch(respondToEvent(post, response)), [dispatch])

  const toggleGroupTopicSubscribeAction = useCallback((groupTopic) => dispatch(toggleGroupTopicSubscribe(groupTopic)), [dispatch])

  const updateGroupTopicLastReadPostAction = useCallback((groupTopicId, postId) => dispatch(updateGroupTopicLastReadPost(groupTopicId, postId)), [dispatch])

  const handleNewPostReceived = useCallback((data) => {
    let updateExisting = false
    messageListRef.current?.data.map((item) => {
      if (item.pending && (data.id === item.id || data.localId && data.localId === item.localId)) {
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

  useEffect(() => {
    // New chat room loaded, reset everything
    dispatch(clearLinkPreview())
    clearImageAttachments()
    setNewPost(emptyPost)

    // Make sure GroupTopic is loaded
    fetchTopicAction()
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
    // New group topic
    if (groupTopic?.id) {
      fetchPostsFuture(0).then(() => setLoadedFuture(true))

      if (groupTopic.lastReadPostId) {
        fetchPostsPast(0).then(() => setLoadedPast(true))
      } else {
        setLoadedPast(true)
      }

      // Reset last read post
      setLastReadPostId(groupTopic.lastReadPostId)
      setLatestOldPostId(groupTopic.lastReadPostId)
    }

    setTimeout(() => {
      // In case we unmounted really quick and its no longer here
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }, 600)
  }, [groupTopic?.id])


  // Do once after loading posts for the room to get things ready
  useEffect(() => {
    if (loadedPast && loadedFuture) {
      setInitialPostToScrollTo((postsPast ? postsPast.length - 1 : 0) + Math.min(postsFuture?.length || 0, 3))
    }
  }, [loadedPast, loadedFuture])

  useEffect(() => {
    // If scrolled to bottom and a new post comes in make sure to scroll down to see new post
    if (atBottom && virtuoso.current) {
      setTimeout(() => {
        scrollToBottom()
      }, 300)
    }
  }, [totalPostsFuture])

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

  const scrollToBottom = useCallback(() => {
    if (virtuoso.current) {
      virtuoso.current.scrollToItem({ index: 'LAST', align: 'end', behavior: 'auto' })
    }
  }, [])

  const handleResizeChats = () => {
    // Make sure when post chat box grows we stay at bottom if already there
    if (atBottom) {
      scrollToBottom()
    }
  }

  useResizeDetector({ handleWidth: false, targetRef: containerRef, onResize: handleResizeChats })

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

  const updateLastReadPost = debounce(700, (lastPost) => {
    if (groupTopic?.id && lastPost && (!lastReadPostId || lastPost.id > lastReadPostId)) {
      setLastReadPostId(lastPost.id)
      updateGroupTopicLastReadPostAction(groupTopic.id, lastPost.id)
    }
  })

  const onRenderedDataChange = useCallback((data) => {
    const lastPost = data[data.length - 1]
    updateLastReadPost(lastPost)
  }, [groupTopic?.id, lastReadPostId])

  // Create a new chat post
  const postChatMessage = useEventCallback(async () => {
    // Only submit if any non-whitespace text has been added
    if (trim(editorRef.current?.getText() || '').length === 0) return

    const details = editorRef.current.getHTML()
    const imageUrls = imageAttachments && imageAttachments.map((attachment) => attachment.url)
    const postToSave = {
      ...newPost,
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
    setCreatedNewPost(true)
    editorRef.current.focus()

    const action = await dispatch(createPost(postToSave))
    const post = action.payload.data.createPost
    // Update the optimistic post with the real post from the server
    messageListRef.current?.data.map((item) => post.localId && item.localId && post.localId === item.localId ? post : item)
    setLastReadPostId(post.id)
    return true
  })

  const postsForDisplay = useMemo(() => (postsPast || []).concat(postsFuture || []), [postsPast, postsFuture])

  if (topicLoading) return <Loading />

  return (
    <div className={cx(styles.container, { [styles.withoutNav]: withoutNav })}>
      <Helmet>
        <title>#{topicName} | {group ? `${group.name} | ` : ''}Hylo</title>
      </Helmet>

      <TopicFeedHeader
        bannerUrl={group && group.bannerUrl}
        currentUser={currentUser}
        followersTotal={followersTotal}
        groupSlug={groupSlug}
        isSubscribed={groupTopic && groupTopic.isSubscribed}
        newPost={newPost}
        toggleSubscribe={
          groupTopic
            ? () => toggleGroupTopicSubscribeAction(groupTopic)
            : null
        }
        topicName={topicName}
      />
      <div id='chats' className='my-0 mx-auto h-[calc(100%-130px)] w-full flex flex-col flex-1 relative' ref={containerRef}>
        {initialPostToScrollTo === null ? <div className={styles.loadingContainer}><Loading />blepp</div> :
          <VirtuosoMessageListLicense licenseKey="">
              <VirtuosoMessageList
                style={{ height: '100%', width: '100%', marginTop: 'auto' }}
                ref={messageListRef}
                context={{ currentUser, loadingPast, loadingFuture, selectedPostId, group, latestOldPostId }}
                initialData={postsForDisplay}
                initialLocation={{ index: initialPostToScrollTo, align: 'end' }}
                computeItemKey={({ data }) => data.id || data.localId}
                onScroll={onScroll}
                onRenderedDataChange={onRenderedDataChange}
                EmptyPlaceholder={EmptyPlaceholder}
                Footer={Footer}
                Header={Header}
                StickyHeader={StickyHeader}
                ItemContent={ItemContent}
              />
            </VirtuosoMessageListLicense>}
      </div>
      <div className={styles.postChatBox}>
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
          className={styles.editor}
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
        <AttachmentManager
          type='post'
          id='new'
          attachmentType='image'
          showAddButton
          showLabel
          showLoading
        />
        <div className={styles.postChatBoxFooter}>
          <UploadAttachmentButton
            type='post'
            className={styles.uploadAttachment}
            id='new'
            attachmentType='image'
            onSuccess={(attachment) => addAttachment('post', 'new', attachment)}
            allowMultiple
          >
            <Icon
              name='AddImage'
              className={cx(styles.actionIcon, { [styles.highlightIcon]: imageAttachments && imageAttachments.length > 0 })}
            />
          </UploadAttachmentButton>
          <Button
            borderRadius='6px'
            disabled={!postInProgress}
            onClick={postChatMessage}
            className={cx(styles.sendMessageButton, { [styles.disabled]: !postInProgress })}
          >
            <IoSend color='white' />
          </Button>
        </div>
      </div>
    </div>
  )
}

/*** Virtuoso Components ***/
const EmptyPlaceholder = ({ context }) => {
  return (<div>{context.loadingPast || context.loadingFuture ? <Loading /> : <NoPosts className={styles.noPosts} />}</div>)
}

const Header = ({ context }) => {
  return context.loadingPast ? <div style={{ height: '30px' }}><Loading /></div> : null
}

const Footer = ({ context }) => {
  return context.loadingFuture ? <div className={styles.loadingContainerBottom}><Loading /></div> : null
}

const StickyHeader = ({ data, prevData }) => {
  const firstItem = useCurrentlyRenderedData()[0]
  return (
    <div className={cx(styles.displayDay, '!absolute top-0')}>
      <div className={styles.day}>{firstItem?.createdAt ? moment(firstItem.createdAt).calendar(null, dayFormats) : ''}</div>
    </div>
  )
}

const ItemContent = ({ data: post, context, prevData, nextData }) => {
  const expanded = context.selectedPostId === post.id
  const firstUnread = context.latestOldPostId === prevData?.id && post.creator.id !== context.currentUser.id
  const previousDay = moment(prevData?.createdAt)
  const currentDay = moment(post.createdAt)
  const displayDay = previousDay.isSame(currentDay, 'day') ? null : currentDay.calendar(null, dayFormats)
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
            <div className={styles.divider} />
            <div className={styles.newPost}>NEW</div>
          </div>
          )
        : null}
      {firstUnread && displayDay
        ? (
          <div className={styles.unreadAndDay}>
            <div className={styles.divider} />
            <div className={styles.newPost}>NEW</div>
            <div className={styles.day}>{displayDay}</div>
          </div>
          )
        : null}
      {!firstUnread && displayDay
        ? (
          <div className={styles.displayDay}>
            <div className={styles.divider} />
            <div className={styles.day}>{displayDay}</div>
          </div>
          )
        : null}
      {post.type === 'chat'
        ? <ChatPost
            expanded={expanded}
            group={context.group}
            showHeader={showHeader}
            post={post}
          />
        : (
          <div className={cx(styles.cardItem, { [styles.expanded]: expanded })}>
            <PostCard
              expanded={expanded}
              post={post}
            />
          </div>
          )}
    </>
  )
}
