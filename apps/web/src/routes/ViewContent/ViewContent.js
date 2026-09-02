import isMobile from 'ismobilejs'
import { get, isEmpty } from 'lodash/fp'
import { Bookmark } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Routes, Route, useLocation } from 'react-router-dom'
import { push } from 'redux-first-history'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { COMMON_VIEWS } from 'store/models/GroupView'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import CollectionDragHandle from 'components/CollectionDragHandle'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import { DateTimeHelpers } from '@hylo/shared'
import Calendar from 'components/Calendar'
import PostDialog from 'components/PostDialog'
import PostListRow from 'components/PostListRow'
import PostCard from 'components/PostCard'
import ChatActivityCard from 'components/PostCard/ChatActivityCard'
import PinnedPostChips from 'routes/ChatRoom/PinnedPostChips'
import MasonryGrid from 'components/MasonryGrid/MasonryGrid'
import PostGridItem from 'components/PostGridItem'
import PostBigGridItem from 'components/PostBigGridItem'
import PostLabel from 'components/PostLabel'
import PostPrompt from './PostPrompt'
import PaywallOfferingsSection from 'routes/GroupDetail/PaywallOfferingsSection'
import MyDrafts from './MyDrafts'
import GroupCalendarSubscribe from '../GroupCalendarSubscribe/GroupCalendarSubscribe'
import ScrollListener from 'components/ScrollListener'
import ViewControls from 'components/StreamViewControls'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { useEffectiveGroupSlug, useGroupRouteOpts } from 'contexts/SpaceGroupContext'
import useRouteParams from 'hooks/useRouteParams'
import useCurrentPinnableView from 'hooks/useCurrentPinnableView'
import useGroupViews from 'hooks/useGroupViews'
import { updateUserSettings } from 'routes/UserSettings/UserSettings.store'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import changeQuerystringParam, { changeQuerystringParams } from 'store/actions/changeQuerystringParam'
import fetchGroupTopic from 'store/actions/fetchGroupTopic'
import fetchTopic from 'store/actions/fetchTopic'
import fetchPosts from 'store/actions/fetchPosts'
import fetchViewPinnedPosts from 'store/actions/fetchViewPinnedPosts'
import { reorderViewPost } from 'store/actions/groupViews'
// import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import { FETCH_POSTS, FETCH_TOPIC, FETCH_GROUP_TOPIC, CONTEXT_MY, VIEW_MENTIONS, VIEW_ANNOUNCEMENTS, VIEW_INTERACTIONS, VIEW_POSTS, VIEW_SAVED_POSTS, VIEW_DRAFTS, RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } from 'store/constants'
import presentPost from 'store/presenters/presentPost'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViewById } from 'store/selectors/getGroupViews'
import getMe from 'store/selectors/getMe'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPosts } from 'store/selectors/getPosts'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import markViewAsRead from 'store/actions/markViewAsRead'
import { TYPED_BADGE_VIEW_TYPES } from 'util/viewUnreadBadges'
import { cn } from 'util/index'
import useTour from 'tours/useTour'
import { STREAM_TOUR_ID, streamTourSteps } from 'tours/streamTour'
import { createPostUrl, groupUrl, spaceUrl } from '@hylo/navigation'
import { getLocaleFromLocalStorage } from 'util/locale'
import { STREAM_MAIN_COLUMN_CLASS } from 'util/mainContentColumn'
import { StreamSkeleton } from 'components/PostCard/PostCardSkeleton'

const viewComponent = {
  cards: PostCard,
  list: PostListRow,
  grid: PostGridItem,
  bigGrid: PostBigGridItem,
  calendar: Calendar
}

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

const MOUSE_ACTIVATION = { distance: 5 }
const TOUCH_ACTIVATION = { delay: 180, tolerance: 8 }

/** Maps a custom/collection GroupView into the stream config shape ViewContent expects. */
function streamConfigFromGroupView (groupView) {
  if (!groupView || !['custom', 'collection'].includes(groupView.type)) return null
  const settings = groupView.settings || {}
  return {
    name: groupView.name,
    icon: groupView.icon,
    type: groupView.type === 'collection' ? 'collection' : 'stream',
    postTypes: settings.postTypes,
    activePostsOnly: settings.activePostsOnly,
    defaultSort: settings.defaultSort,
    defaultViewMode: settings.defaultViewMode,
    searchText: settings.searchText,
    topics: groupView.topics || [],
    collectionId: groupView.type === 'collection' ? groupView.id : null
  }
}

/** Returns true when a post's groups should be shown: child-group posts in /groups, or any post in /my, /all, /public. */
function isChildGroupPost ({ context, groupSlug, post }) {
  const groupSlugs = post.groups?.map(group => group.slug) || []
  if (groupSlugs.length === 0) return false
  if ([CONTEXT_MY, 'all', 'public'].includes(context)) return true
  return !groupSlugs.includes(groupSlug)
}

/** Returns true when a child post comes from a space (group type === 'space'). */
function isChildSpacePost ({ context, groupSlug, post }) {
  if (!isChildGroupPost({ context, groupSlug, post })) return false
  return (post.groups || []).some(group => group.type === 'space')
}

export default function ViewContent (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()
  const { t } = useTranslation()

  // First-visit tour of the stream's icon-only controls, offered by invitation
  const streamTourStepList = useMemo(() => streamTourSteps(t), [t])
  const { invitation: streamTourInvitation } = useTour({
    id: STREAM_TOUR_ID,
    steps: streamTourStepList,
    autoStart: true,
    inviteMessage: t('Want a quick tour of these stream controls?')
  })
  const groupSlug = useEffectiveGroupSlug()
  const { parentGroupSlug, spaceSlug } = useGroupRouteOpts()
  const { topicName, customViewId } = routeParams
  const context = props.context
  const currentUser = useSelector(getMe)

  const [container, setContainer] = useState(null)

  // `/my/drafts` historically resolves without an explicit `view` param; keep
  // this guard so the drafts template still renders when the path comes through.
  const isMyDraftsRoute = context === CONTEXT_MY && (routeParams.view === VIEW_DRAFTS || location.pathname.includes('/my/drafts'))

  const view = props.view || (isMyDraftsRoute ? VIEW_DRAFTS : routeParams.view)
  const isDraftsView = context === CONTEXT_MY && view === VIEW_DRAFTS

  const systemView = COMMON_VIEWS[view]

  const currentUserHasMemberships = useSelector(state => !isEmpty(getMyMemberships(state)))
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const parentGroup = useSelector(state => parentGroupSlug ? getGroupForSlug(state, parentGroupSlug) : null)
  const groupId = group?.id || 0
  const hasAccess = group?.canAccess !== false
  const showPaywallBlock =
    Boolean(group?.paywall && !hasAccess && context !== CONTEXT_MY && context !== 'public' && groupSlug)
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const groupView = useSelector(state =>
    getGroupViewById(state, group, customViewId) ||
    (parentGroup ? getGroupViewById(state, parentGroup, customViewId) : null)
  )
  const presentedGroupView = useMemo(
    () => (groupView ? GroupViewPresenter(groupView) : null),
    [groupView]
  )
  const streamViewConfig = useMemo(
    () => streamConfigFromGroupView(groupView),
    [groupView]
  )

  const groupViews = useGroupViews(group)
  const showChatActivity = useMemo(() => {
    const allView = (groupViews || []).find(v => v.type === 'all')
    return allView?.settings?.showChatActivity !== false
  }, [groupViews])
  const typedBadgeView = useMemo(() => {
    if (!TYPED_BADGE_VIEW_TYPES.has(view)) return null
    return (groupViews || []).find(v => v.type === view) || null
  }, [groupViews, view])

  const pinnableView = useCurrentPinnableView()
  const canModerateContent = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_CONTENT, groupId: group?.id }))
  const canManageCollection = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: [RESP_ADMINISTRATION, RESP_MANAGE_CONTENT],
    groupId: group?.id
  }))

  useEffect(() => {
    if (!group?.id || !pinnableView?.id) return
    dispatch(fetchViewPinnedPosts(group.id, pinnableView.id))
  }, [dispatch, group?.id, pinnableView?.id])

  // Clear typed-view unread when opening Events/Proposals/etc.
  useEffect(() => {
    if (!typedBadgeView?.id || !group?.id) return
    if (!(typedBadgeView.newPostCount > 0)) return
    dispatch(markViewAsRead(typedBadgeView.id, group.id))
  }, [dispatch, typedBadgeView?.id, typedBadgeView?.newPostCount, group?.id])

  const topicLoading = useSelector(state => isPendingFor([FETCH_TOPIC, FETCH_GROUP_TOPIC], state))

  const customViewLoading = Boolean(
    customViewId && ((group && group.groupViews == null) || (parentGroup && parentGroup.groupViews == null))
  )

  // Do not block the stream on topic refetch when Topic is already in the ORM (e.g. redux-persist (if we ever bring that back)).
  const topicBlockingStreams = Boolean(topicName) && topicLoading && !topic

  const defaultSortBy = systemView?.defaultSortBy || get('settings.streamSortBy', currentUser) || 'created'
  const defaultViewMode = systemView?.defaultViewMode || get('settings.streamViewMode', currentUser) || 'cards'
  // All Activity should not inherit a leftover type filter from other views
  const defaultPostType = view === 'all'
    ? undefined
    : (systemView?.defaultPostType || get('settings.streamPostType', currentUser) || undefined)
  const defaultActivePostsOnly = systemView?.defaultActivePostsOnly || get('settings.activePostsOnly', currentUser) || false
  const defaultChildPostInclusion = get('settings.streamChildPosts', currentUser) || systemView?.defaultChildPostInclusion || 'yes'

  const querystringParams = getQuerystringParam(['s', 't', 'v', 'c', 'search', 'timeframe', 'activeOnly', 'calendarMode', 'calendarDate'], location)

  const search = querystringParams.search || streamViewConfig?.searchText
  const configuredViewMode = querystringParams.v || streamViewConfig?.defaultViewMode || defaultViewMode
  const viewMode = configuredViewMode === 'map' ? 'cards' : configuredViewMode
  const isCalendarViewMode = viewMode === 'calendar'
  const collectionDefaultSort = streamViewConfig?.type === 'collection' ? 'order' : defaultSortBy
  let sortBy = querystringParams.s || streamViewConfig?.defaultSort || collectionDefaultSort
  if (!streamViewConfig && sortBy === 'order') {
    sortBy = 'updated'
  }
  if (view === 'events' || isCalendarViewMode) {
    sortBy = 'start_time'
  }
  const activePostsOnly = (querystringParams.activeOnly === 'true') || (!querystringParams.activeOnly && ((streamViewConfig?.type === 'stream' && streamViewConfig.activePostsOnly) || defaultActivePostsOnly))
  const childPostInclusion = querystringParams.c || defaultChildPostInclusion
  const timeframe = querystringParams.timeframe || 'future'

  const postTypesAvailable = useMemo(() => {
    if (streamViewConfig?.type === 'stream') return streamViewConfig?.postTypes
    if (systemView) return systemView?.postTypes
    return null
  }, [streamViewConfig, systemView])

  // Prefer querystring, then user/view default; ignore defaults outside this view's allowed types
  const postTypeFilter = useMemo(() => {
    const selected = querystringParams.t || defaultPostType || undefined
    if (!selected || selected === 'all') return undefined
    if (postTypesAvailable && !postTypesAvailable.includes(selected)) return undefined
    return selected
  }, [querystringParams.t, defaultPostType, postTypesAvailable])

  const topics = topic ? [topic.id] : streamViewConfig?.type === 'stream' ? streamViewConfig.topics : []

  const calendarModes = ['day', 'week', 'month']
  const calendarMode = calendarModes.includes(querystringParams.calendarMode)
    ? querystringParams.calendarMode
    : 'month'
  const calendarDate = useMemo(() => {
    const dateParam = querystringParams.calendarDate
    if (!dateParam) return new Date()
    const parsed = DateTimeHelpers.toDateTime(dateParam, { locale: getLocaleFromLocalStorage() })
    return parsed.isValid ? parsed.toJSDate() : new Date()
  }, [querystringParams.calendarDate])
  const eventCalendarUrl = useMemo(() => group?.eventCalendarUrl || '', [group])
  const rsvpCalendarUrl = useMemo(() => currentUser?.rsvpCalendarUrl || '', [currentUser])

  const handleEnsureRsvpCalendarUrl = useCallback(async () => {
    const payload = await dispatch(updateUserSettings({ settings: { rsvpCalendarSub: true } }))
    return get('data.updateMe.rsvpCalendarUrl', payload) || null
  }, [dispatch])

  const fetchPostsParam = useMemo(() => {
    if (isDraftsView) {
      return {
        activePostsOnly,
        childPostInclusion,
        context,
        filter: postTypeFilter,
        first: 0,
        forCollection: null,
        groupId: group?.id,
        search,
        slug: groupSlug,
        sortBy,
        topics,
        types: postTypesAvailable
      }
    }

    const numPostsToLoad = isMobile.any ? 10 : 20
    const includeChatActivity = view === 'all' && !postTypeFilter && !isCalendarViewMode && showChatActivity

    const params = {
      activePostsOnly,
      childPostInclusion,
      context,
      filter: includeChatActivity
        ? 'all+notices'
        : postTypeFilter,
      first: numPostsToLoad,
      forCollection: streamViewConfig?.type === 'collection' ? streamViewConfig.collectionId : null,
      groupId: group?.id,
      search,
      slug: groupSlug,
      sortBy,
      topics,
      // Do not send a types list with all+notices — a stream-only list would hide notices
      types: includeChatActivity ? undefined : postTypesAvailable
    }

    if (isCalendarViewMode) {
      const luxonDate = DateTimeHelpers.toDateTime(calendarDate, { locale: getLocaleFromLocalStorage() })
      params.afterTime = luxonDate.startOf('month').startOf('week', { useLocaleWeeks: true }).startOf('day').toISO()
      params.beforeTime = luxonDate.endOf('month').endOf('week', { useLocaleWeeks: true }).plus({ day: 1 }).endOf('day').toISO()
      params.order = 'asc'
      // Stream calendar has no view-level postTypes; events view already sets types: ['event']
      if (!params.filter && !params.types?.length) {
        params.filter = 'event'
      }
    } else if (view === 'events') {
      const today = DateTimeHelpers.dateTimeNow(getLocaleFromLocalStorage()).toISO()
      params.afterTime = timeframe === 'future' ? today : undefined
      params.beforeTime = timeframe === 'past' ? today : undefined
      params.order = timeframe === 'future' ? 'asc' : 'desc'
    }
    if (context === CONTEXT_MY) {
      switch (view) {
        case VIEW_MENTIONS:
          params.mentionsOf = [currentUser.id]
          break
        case VIEW_ANNOUNCEMENTS:
          params.announcementsOnly = true
          break
        case VIEW_INTERACTIONS:
          params.interactedWithBy = [currentUser.id]
          break
        case VIEW_POSTS:
          params.createdBy = [currentUser.id]
          break
        case VIEW_SAVED_POSTS:
          params.savedBy = [currentUser.id]
          params.sortBy = 'saved'
          params.filter = 'chat' // This means all posts + chat posts
          break
      }
    }
    return params
  }, [activePostsOnly, calendarDate, isCalendarViewMode, childPostInclusion, context, streamViewConfig, group?.id, groupSlug, postTypeFilter, search, showChatActivity, sortBy, timeframe, topic?.id, topicName, view])

  let name = presentedGroupView
    ? displayNameForView(presentedGroupView, t)
    : (view === 'all' ? t('view-all') : (systemView?.name || t('view-all')))
  let icon = presentedGroupView?.lucideIcon
    ? <GroupViewIcon view={presentedGroupView} className='w-5 h-5' />
    : systemView?.lucideIcon
      ? <GroupViewIcon view={{ lucideIcon: systemView.lucideIcon }} className='w-5 h-5' />
      : (presentedGroupView?.iconName || systemView?.iconName)
  if (topicName) {
    name = '#' + topicName
  }

  if (context === CONTEXT_MY) {
    switch (view) {
      case VIEW_MENTIONS:
        name = t('Mentions')
        icon = 'Email'
        break
      case VIEW_ANNOUNCEMENTS:
        name = t('Announcements')
        icon = 'Announcement'
        break
      case VIEW_INTERACTIONS:
        name = t('Interactions')
        icon = 'Support'
        break
      case VIEW_POSTS:
        name = t('Posts')
        icon = 'Posticon'
        break
      case VIEW_DRAFTS:
        name = t('Drafts')
        icon = 'FilePenLine'
        break
      case VIEW_SAVED_POSTS:
        name = t('Saved Posts')
        icon = <Bookmark />
        break
    }
  }

  const postsSelector = useSelector((state) => getPosts(state, fetchPostsParam))
  const posts = useMemo(() => {
    const presented = postsSelector.map(p => presentPost(p, groupId)).filter(Boolean)
    if (showChatActivity) return presented
    return presented.filter(p => p.type !== 'chat_activity')
  }, [groupId, postsSelector, showChatActivity])
  const pinnedPosts = useMemo(() => {
    return (pinnableView?.pinnedPosts || []).map(p => presentPost(p, groupId)).filter(Boolean)
  }, [groupId, pinnableView?.pinnedPosts])
  // Stream/grid/list: pinned cards sit above the feed. Prefer the feed copy so
  // ORM-backed fields (creator avatar) stay intact after an optimistic pin.
  const streamPosts = useMemo(() => {
    if (isCalendarViewMode) return posts
    // Manual collection order is the source of truth; don't lift pins above it.
    if (streamViewConfig?.type === 'collection' && sortBy === 'order') return posts
    const order = (pinnableView?.pinnedPostIds || []).map(id => String(id))
    if (order.length === 0 && pinnedPosts.length === 0) return posts
    const ids = order.length ? order : pinnedPosts.map(p => String(p.id))
    const feedById = new Map(posts.map(p => [String(p.id), p]))
    const pinById = new Map(pinnedPosts.map(p => [String(p.id), p]))
    const top = ids.map(id => feedById.get(id) || pinById.get(id)).filter(Boolean)
    const topIds = new Set(top.map(p => String(p.id)))
    return [...top, ...posts.filter(p => !topIds.has(String(p.id)))]
  }, [isCalendarViewMode, pinnableView?.pinnedPostIds, pinnedPosts, posts, sortBy, streamViewConfig?.type])
  const hasMore = useSelector(state => getHasMorePosts(state, fetchPostsParam))
  const pending = useSelector(state => state.pending[FETCH_POSTS])

  const collectionSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const canReorderCollection = Boolean(
    streamViewConfig?.type === 'collection' &&
    streamViewConfig?.collectionId &&
    group?.id &&
    canManageCollection &&
    sortBy === 'order' &&
    !isCalendarViewMode &&
    !search &&
    !postTypeFilter &&
    streamPosts.length > 1
  )
  const isGridCollectionView = viewMode === 'grid' || viewMode === 'bigGrid'

  const handleCollectionDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const viewId = streamViewConfig?.collectionId
    if (!viewId || !group?.id) return
    const overIndex = over.data.current?.sortable?.index
    if (overIndex == null) return
    dispatch(reorderViewPost({
      groupId: group.id,
      viewId,
      postId: active.id,
      order: overIndex
    }))
  }, [dispatch, group?.id, streamViewConfig?.collectionId])

  const fetchPostsFrom = useCallback((offset) => {
    if (pending && offset > 0) return
    if (hasMore === false && offset > 0) return
    dispatch(fetchPosts({ offset, ...fetchPostsParam }))
  }, [dispatch, pending, hasMore, fetchPostsParam])

  useEffect(() => {
    if (view !== 'custom' || !customViewId || !streamViewConfig) return
    if (querystringParams.v) return
    if (streamViewConfig.defaultViewMode !== 'map') return
    const slug = parentGroupSlug || groupSlug
    if (!slug) return
    if (spaceSlug && parentGroupSlug) {
      dispatch(push(spaceUrl(parentGroupSlug, spaceSlug, 'map')))
      return
    }
    dispatch(push(groupUrl(slug, 'map')))
  }, [view, customViewId, streamViewConfig, querystringParams.v, parentGroupSlug, spaceSlug, groupSlug, dispatch])

  useEffect(() => {
    if (topicName) {
      if (groupSlug) {
        dispatch(fetchGroupTopic(topicName, groupSlug))
      } else {
        dispatch(fetchTopic(topicName))
      }
    }
  }, [topicName])

  useEffect(() => {
    if (view === 'events' || isCalendarViewMode) {
      dispatch(dropPostResults(fetchPostsParam))
    }
  }, [dispatch, fetchPostsParam, isCalendarViewMode, view])

  useEffect(() => {
    if (isDraftsView) return
    if ((!customViewId || streamViewConfig?.type === 'stream' || streamViewConfig?.type === 'collection') && (!topicName || topic)) {
      // Fetch posts, unless the custom view has not fully loaded yet, or the topic has not fully loaded yet
      fetchPostsFrom(0)
    }
  }, [fetchPostsParam, isDraftsView])

  useEffect(() => {
    if (!isCalendarViewMode || isDraftsView) return
    if (customViewId && streamViewConfig?.type !== 'stream' && streamViewConfig?.type !== 'collection') return
    if (topicName && !topic) return
    if (pending || hasMore !== true || posts.length === 0) return
    fetchPostsFrom(posts.length)
  }, [
    isCalendarViewMode,
    isDraftsView,
    customViewId,
    streamViewConfig?.type,
    topicName,
    topic,
    pending,
    hasMore,
    posts.length,
    fetchPostsFrom
  ])

  const changePostTypeFilter = useCallback(postType => {
    dispatch(updateUserSettings({ settings: { streamPostType: postType || '' } }))
    dispatch(changeQuerystringParam(location, 't', postType, 'all'))
  }, [location])

  const changeSort = useCallback(sort => {
    dispatch(updateUserSettings({ settings: { streamSortBy: sort } }))
    dispatch(changeQuerystringParam(location, 's', sort, 'all'))
  }, [location])

  const changeView = useCallback(view => {
    dispatch(updateUserSettings({ settings: { streamViewMode: view } }))
    dispatch(changeQuerystringParam(location, 'v', view, 'cards'))
  }, [location])

  const changeActivePostsOnly = useCallback(v => {
    dispatch(changeQuerystringParam(location, 'activeOnly', v, false))
  }, [location])

  const changeChildPostInclusion = useCallback(childPostsBool => {
    dispatch(updateUserSettings({ settings: { streamChildPosts: childPostsBool } }))
    dispatch(changeQuerystringParam(location, 'c', childPostsBool, 'yes'))
  }, [location])

  const changeSearch = useCallback(search => {
    dispatch(changeQuerystringParam(location, 'search', search, 'all'))
  }, [location])

  const changeTimeframe = useCallback(timeframe => {
    dispatch(changeQuerystringParam(location, 'timeframe', timeframe, 'future'))
  }, [location])

  const updateCalendarQueryParams = useCallback((updates) => {
    const params = {}
    if (updates.mode !== undefined) {
      params.calendarMode = updates.mode
    }
    if (updates.date !== undefined) {
      params.calendarDate = DateTimeHelpers.toDateTime(updates.date, { locale: getLocaleFromLocalStorage() }).toISODate()
    }
    if (Object.keys(params).length > 0) {
      dispatch(changeQuerystringParams(location, params))
    }
  }, [dispatch, location])

  const changeCalendarMode = useCallback(mode => {
    updateCalendarQueryParams({ mode })
  }, [updateCalendarQueryParams])

  const changeCalendarDate = useCallback(date => {
    updateCalendarQueryParams({ date })
  }, [updateCalendarQueryParams])

  const newPost = useCallback(() => dispatch(push(createPostUrl(routeParams, querystringParams))), [routeParams, querystringParams])

  // Refresh calendar when returning from the create modal (a post may have been created)
  const prevPathWasCreateRef = useRef(false)
  useEffect(() => {
    const isCreatePath = location.pathname.includes('/create/')
    if (prevPathWasCreateRef.current && !isCreatePath && isCalendarViewMode) {
      dispatch(dropPostResults(fetchPostsParam))
      fetchPostsFrom(0)
    }
    prevPathWasCreateRef.current = isCreatePath
  }, [location.pathname, isCalendarViewMode, dispatch, fetchPostsParam, fetchPostsFrom])

  const hasPostPrompt = currentUserHasMemberships && context !== CONTEXT_MY && view !== 'explore'
  // Calendar view applies on both `/events` (default) and `/stream?v=calendar`.
  // Default new-post type to event in calendar mode; `/events` list view uses COMMON_VIEWS postTypes.
  const postTypesForPrompt = useMemo(() => {
    if (view === 'events') return postTypesAvailable || ['event']
    if (isCalendarViewMode) return ['event']
    return postTypesAvailable
  }, [view, isCalendarViewMode, postTypesAvailable])

  const eventDateForCreate = useMemo(() => {
    if (!isCalendarViewMode || calendarMode !== 'day') return null
    return DateTimeHelpers.toDateTime(calendarDate, { locale: getLocaleFromLocalStorage() }).toISODate()
  }, [isCalendarViewMode, calendarMode, calendarDate])

  const info = useMemo(() => {
    if (streamViewConfig?.type === 'stream') {
      const topicNames = streamViewConfig.topics || []
      return (
        <div className='flex flex-row gap-2 items-center'>
          <span className='text-sm'>
            {t('Displaying')}:&nbsp;
            {streamViewConfig?.activePostsOnly ? t('Only active') : ''}
          </span>

          {streamViewConfig?.postTypes.length === 0 ? t('None') : streamViewConfig?.postTypes.map((p, i) => <span key={i}><PostLabel key={p} type={p} className='align-middle mr-2' />{p}s&nbsp;</span>)}
          {topicNames.length > 0 && <div>{t('filtered by topics:')}</div>}
          {topicNames.length > 0 && topicNames.map(topicName => <span key={topicName}>#{topicName}</span>)}
        </div>
      )
    } else if (streamViewConfig?.type === 'collection') {
      return t('Curated Post Collection')
    } else if (topicName) {
      return t('Filtered by topic #{{topicName}}', { topicName })
    }
    return null
  }, [streamViewConfig, topicName, t])

  const noPostsMessage = view === 'events'
    ? t('No {{timeFrame}} events', { timeFrame: timeframe === 'future' ? t('upcoming') : t('past') })
    : t('Nothing here yet')

  // The empty-state create button pre-selects the view's post type when there
  // is exactly one (events view, a filtered stream, a single-type custom view)
  const createFromEmpty = useCallback(() => {
    const type = postTypeFilter || (postTypesForPrompt?.length === 1 ? postTypesForPrompt[0] : null)
    const params = { ...querystringParams }
    if (type) params.newPostType = type
    dispatch(push(createPostUrl(routeParams, params)))
  }, [dispatch, routeParams, querystringParams, postTypeFilter, postTypesForPrompt])

  const showEmptyStream = !pending && !topicBlockingStreams && !customViewLoading && streamPosts.length === 0

  const calendarInitialLoading = (pending || topicBlockingStreams || customViewLoading) && isCalendarViewMode && posts.length === 0
  const calendarFetchingMore = pending && isCalendarViewMode && posts.length > 0
  const showCalendar = !customViewLoading && !topicBlockingStreams && isCalendarViewMode && (posts.length > 0 || !pending)

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    if (isDraftsView) {
      setHeaderDetails({ title: t('Drafts'), icon: 'FilePenLine', info: null, search: false })
      return
    }
    setHeaderDetails({
      title: name,
      icon,
      info,
      search: true
    })
  }, [icon, info, isDraftsView, name, setHeaderDetails, t])

  if (isDraftsView) {
    return (
      <div id='stream-outer-container' className='flex flex-col h-full overflow-auto'>
        <Helmet>
          <title>{`${t('Drafts')} | Hylo`}</title>
          <meta name='description' content={t('Drafts')} />
        </Helmet>
        <div className='flex flex-col flex-1 w-full mx-auto p-1 sm:p-4 max-w-[750px]'>
          <MyDrafts />
        </div>
      </div>
    )
  }

  return (
    <div id='stream-outer-container' className='flex flex-col h-full overflow-auto' ref={setContainer}>
      {streamTourInvitation}
      <Helmet>
        <title>{name} | {group ? `${group.name} | ` : context} | Hylo</title>
        <meta name='description' content={group ? `Posts from ${group.name}. ${group.description}` : 'Group Not Found'} />
      </Helmet>

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>

      {!showPaywallBlock && (
        // The pinned header: New on the left, the stream controls right-justified,
        // one row spanning the full stream pane — outside the width-capped column
        // below, so it runs from the context menu to the viewport's right edge.
        // Its backdrop is the theme background fading to transparent: opaque for the
        // controls' own height, with the fade entirely in the padding strip below,
        // so posts pass under a soft shadow edge instead of showing through the bar.
        // A translucent wash of the theme background fading to the SAME color at zero
        // alpha — to-transparent would interpolate toward transparent black and smudge
        // grey in light mode. Arbitrary values because theme-background's config has no
        // <alpha-value> placeholder, so slash-opacity classes are silently ignored.
        // Heavier wash in dark mode: a light page only needs a whisper of ground, but
        // the same alpha on a dark background disappears against the dark stream.
        <div className='sticky top-0 z-20 w-full bg-gradient-to-b from-[hsl(var(--theme-background)/0.1)] dark:from-[hsl(var(--theme-background)/0.5)] to-[hsl(var(--theme-background)/0)]'>
          <div className='flex flex-row items-start gap-2 px-2 sm:px-4 pt-2 sm:pt-4 pb-6'>
            {hasPostPrompt && (
              <PostPrompt
                avatarUrl={currentUser.avatarUrl}
                firstName={currentUser.firstName()}
                newPost={newPost}
                postTypesAvailable={postTypesForPrompt}
                eventDate={eventDateForCreate}
              />
            )}
            <div className='flex-1 min-w-0'>
              <ViewControls
                routeParams={routeParams} view={view} postTypeFilter={postTypeFilter} postTypesAvailable={postTypesAvailable} customViewType={streamViewConfig?.type}
                sortBy={sortBy} viewMode={viewMode} searchValue={search}
                changePostTypeFilter={changePostTypeFilter} context={context} changeSort={changeSort} changeView={changeView} changeSearch={changeSearch}
                changeChildPostInclusion={changeChildPostInclusion} childPostInclusion={childPostInclusion}
                changeTimeframe={changeTimeframe} timeframe={timeframe} activePostsOnly={activePostsOnly} changeActivePostsOnly={changeActivePostsOnly}
              />
            </div>
          </div>
        </div>
      )}

      <div
        id='stream-inner-container'
        className={cn(
          'flex flex-col flex-1',
          !isCalendarViewMode && STREAM_MAIN_COLUMN_CLASS,
          isCalendarViewMode && 'w-full mx-auto p-1 sm:p-4'
        )}
      >
        {showPaywallBlock
          ? (
            <div className='mt-4'>
              <PaywallOfferingsSection group={group} sellingGroup={parentGroup} />
            </div>
            )
          : (
            <>
              {isCalendarViewMode && (
                <PinnedPostChips
                  posts={pinnedPosts}
                  viewId={pinnableView?.id}
                  groupId={group?.id}
                  canModerate={canModerateContent}
                  className='px-1 pb-1'
                />
              )}
              {calendarFetchingMore && (
                <div
                  aria-live='polite'
                  className='sticky top-2 z-20 flex justify-end pointer-events-none h-0 overflow-visible'
                >
                  <Loading
                    type='inline'
                    className='mr-1 sm:mr-2 rounded-full bg-midground/90 px-2 py-1 shadow-sm backdrop-blur-sm'
                  />
                </div>
              )}
              {!isCalendarViewMode && (
                <CollectionPostsGrid
                  canReorder={canReorderCollection}
                  sensors={collectionSensors}
                  isGridView={isGridCollectionView}
                  onDragEnd={handleCollectionDragEnd}
                  streamPosts={streamPosts}
                  viewMode={viewMode}
                  showEmptyStream={showEmptyStream}
                  noPostsMessage={noPostsMessage}
                  hasPostPrompt={hasPostPrompt}
                  onCreateFromEmpty={createFromEmpty}
                  routeParams={routeParams}
                  group={group}
                  currentUser={currentUser}
                  querystringParams={querystringParams}
                  context={context}
                  groupSlug={groupSlug}
                />
              )}
              {showCalendar && (
                <div className='calendarView'>
                  <Calendar
                    posts={posts}
                    group={group}
                    routeParams={routeParams}
                    querystringParams={querystringParams}
                    date={calendarDate}
                    setDate={changeCalendarDate}
                    mode={calendarMode}
                    setMode={changeCalendarMode}
                    updateCalendarView={updateCalendarQueryParams}
                  />
                  {group && calendarMode === 'month' && <GroupCalendarSubscribe eventCalendarUrl={eventCalendarUrl} />}
                  {!group && view === 'events' && calendarMode === 'month' && (
                    <GroupCalendarSubscribe
                      eventCalendarUrl={rsvpCalendarUrl}
                      buttonLabel={t('Subscribe to all the Hylo events you have RSVPed to')}
                      modalTitle={t('Subscribe to all the Hylo events you have RSVPed to')}
                      onEnsureCalendarUrl={handleEnsureRsvpCalendarUrl}
                    />
                  )}
                </div>
              )}

              {(pending || topicBlockingStreams || customViewLoading) && !isCalendarViewMode && (
                posts.length === 0
                  ? <StreamSkeleton wrapWithMainColumn={false} />
                  : <StreamSkeleton wrapWithMainColumn={false} placeholderCount={2} />
              )}
              {calendarInitialLoading && <Loading />}

              {!isCalendarViewMode && (
                <ScrollListener
                  onBottom={() => fetchPostsFrom(posts.length)}
                  elementId='stream-outer-container'
                />
              )}
            </>
            )}
      </div>
    </div>
  )
}

/** Stream/grid/list of collection posts, with optional handle-only reorder. */
function CollectionPostsGrid ({
  canReorder,
  sensors,
  isGridView,
  onDragEnd,
  streamPosts,
  viewMode,
  showEmptyStream,
  noPostsMessage,
  hasPostPrompt,
  onCreateFromEmpty,
  routeParams,
  group,
  currentUser,
  querystringParams,
  context,
  groupSlug
}) {
  const { t } = useTranslation()
  const gridClassName = cn(
    'my-[5px] mx-auto overflow-visible w-full',
    viewMode === 'grid' && 'grid grid-cols-2 min-[426px]:grid-cols-3 items-start gap-x-2 p-2',
    viewMode === 'bigGrid' && 'grid grid-cols-2 items-start gap-x-2 p-2',
    viewMode === 'list' && streamPosts.length > 0 && 'border-2 border-foreground/10 rounded-md bg-card overflow-hidden',
    showEmptyStream && 'flex-1 flex flex-col justify-center'
  )

  const postItems = streamPosts.map(post => {
    const ViewComponent = post.type === 'chat_activity'
      ? ChatActivityCard
      : viewComponent[viewMode]
    const card = (
      <ViewComponent
        className={cn(viewMode === 'cards' && 'max-[425px]:mx-[5px] max-[425px]:mb-2.5')}
        routeParams={routeParams}
        post={post}
        group={group}
        currentGroupId={group && group.id}
        currentUser={currentUser}
        querystringParams={querystringParams}
        childPost={isChildGroupPost({ context, groupSlug, post })}
        childPostFromSpace={isChildSpacePost({ context, groupSlug, post })}
      />
    )

    if (!canReorder) {
      return <React.Fragment key={post.id}>{card}</React.Fragment>
    }

    return (
      <SortableCollectionPost key={post.id} id={post.id}>
        {card}
      </SortableCollectionPost>
    )
  })

  const grid = (
    <MasonryGrid
      enabled={viewMode === 'grid' || viewMode === 'bigGrid'}
      gap={8}
      className={gridClassName}
    >
      {showEmptyStream ? <NoPosts message={noPostsMessage} actionLabel={hasPostPrompt ? t('Create something') : null} onAction={onCreateFromEmpty} /> : ''}
      {postItems}
    </MasonryGrid>
  )

  if (!canReorder) return grid

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={isGridView ? undefined : [restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={streamPosts.map(post => post.id)}
        strategy={isGridView ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {grid}
      </SortableContext>
    </DndContext>
  )
}

/** Positions a hover-revealed drag handle over a collection post. */
function SortableCollectionPost ({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    opacity: isDragging ? 0.4 : 1
  }

  return (
    <div ref={setNodeRef} style={style} className='relative group'>
      {children}
      <CollectionDragHandle
        attributes={attributes}
        listeners={listeners}
        className='absolute left-1 top-2 z-20'
      />
    </div>
  )
}
