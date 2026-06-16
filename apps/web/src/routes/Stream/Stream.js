import isMobile from 'ismobilejs'
import { get, isEmpty } from 'lodash/fp'
import { Bookmark } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Routes, Route, useLocation } from 'react-router-dom'
import { push } from 'redux-first-history'
import { createSelector as ormCreateSelector } from 'redux-orm'

import { COMMON_VIEWS } from '@hylo/presenters/ContextWidgetPresenter'
import Loading from 'components/Loading'
import NoPosts from 'components/NoPosts'
import { DateTimeHelpers } from '@hylo/shared'
import Calendar from 'components/Calendar'
import PostDialog from 'components/PostDialog'
import PostListRow from 'components/PostListRow'
import PostCard from 'components/PostCard'
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
import useRouteParams from 'hooks/useRouteParams'
import { updateUserSettings } from 'routes/UserSettings/UserSettings.store'
import changeQuerystringParam, { changeQuerystringParams } from 'store/actions/changeQuerystringParam'
import fetchCustomView from 'store/actions/fetchCustomView'
import fetchGroupTopic from 'store/actions/fetchGroupTopic'
import fetchTopic from 'store/actions/fetchTopic'
import fetchPosts from 'store/actions/fetchPosts'
// import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import { FETCH_POSTS, FETCH_TOPIC, FETCH_GROUP_TOPIC, FETCH_CUSTOM_VIEW, CONTEXT_MY, VIEW_MENTIONS, VIEW_ANNOUNCEMENTS, VIEW_INTERACTIONS, VIEW_POSTS, VIEW_SAVED_POSTS, VIEW_DRAFTS } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPosts } from 'store/selectors/getPosts'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import { cn } from 'util/index'
import { createPostUrl } from '@hylo/navigation'
import { getLocaleFromLocalStorage } from 'util/locale'
import { STREAM_MAIN_COLUMN_CLASS } from 'util/mainContentColumn'
import { StreamSkeleton } from 'components/PostCard/PostCardSkeleton'

import styles from './Stream.module.scss'

const viewComponent = {
  cards: PostCard,
  list: PostListRow,
  grid: PostGridItem,
  bigGrid: PostBigGridItem,
  calendar: Calendar
}

const getCustomView = ormCreateSelector(
  orm,
  (_, customViewId) => customViewId,
  (session, id) => session.CustomView.safeGet({ id })
)

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

function isChildGroupPost ({ context, groupSlug, post }) {
  if ([CONTEXT_MY, 'all', 'public'].includes(context)) return false
  const groupSlugs = post.groups?.map(group => group.slug) || []
  if (groupSlugs.length === 0) return false
  return !groupSlugs.includes(groupSlug)
}

export default function Stream (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()
  const { t } = useTranslation()
  const { groupSlug, topicName, customViewId } = routeParams
  const context = props.context
  const currentUser = useSelector(getMe)

  const [container, setContainer] = useState(null)

  // `/my/drafts` historically resolves without an explicit `view` param; keep
  // this guard so the drafts template still renders when the path comes through.
  const isMyDraftsRoute = context === CONTEXT_MY && (routeParams.view === VIEW_DRAFTS || location.pathname.includes('/my/drafts'))

  const view = props.view || (isMyDraftsRoute ? VIEW_DRAFTS : routeParams.view)
  const isDraftsView = context === CONTEXT_MY && view === VIEW_DRAFTS

  const currentUserHasMemberships = useSelector(state => !isEmpty(getMyMemberships(state)))
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupId = group?.id || 0
  const hasAccess = group?.canAccess !== false
  const showPaywallBlock =
    Boolean(group?.paywall && !hasAccess && context !== CONTEXT_MY && context !== 'public' && groupSlug)
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const systemView = COMMON_VIEWS[view]
  const customView = useSelector(state => getCustomView(state, customViewId))

  const topicLoading = useSelector(state => isPendingFor([FETCH_TOPIC, FETCH_GROUP_TOPIC], state))

  const customViewLoading = useSelector(state =>
    customViewId ? isPendingFor(FETCH_CUSTOM_VIEW, state) : false
  )

  // Do not block the stream on topic refetch when Topic is already in the ORM (e.g. redux-persist (if we ever bring that back)).
  const topicBlockingStreams = Boolean(topicName) && topicLoading && !topic

  const defaultSortBy = systemView?.defaultSortBy || get('settings.streamSortBy', currentUser) || 'created'
  const defaultViewMode = systemView?.defaultViewMode || get('settings.streamViewMode', currentUser) || 'cards'
  const defaultPostType = systemView?.defaultPostType || get('settings.streamPostType', currentUser) || undefined
  const defaultActivePostsOnly = systemView?.defaultActivePostsOnly || get('settings.activePostsOnly', currentUser) || false
  const defaultChildPostInclusion = get('settings.streamChildPosts', currentUser) || systemView?.defaultChildPostInclusion || 'yes'

  const querystringParams = getQuerystringParam(['s', 't', 'v', 'c', 'search', 'timeframe', 'activeOnly', 'calendarMode', 'calendarDate'], location)

  const search = querystringParams.search
  const viewMode = querystringParams.v || customView?.defaultViewMode || defaultViewMode
  const isCalendarViewMode = viewMode === 'calendar'
  let sortBy = querystringParams.s || customView?.defaultSort || defaultSortBy
  if (!customView && sortBy === 'order') {
    sortBy = 'updated'
  }
  if (view === 'events' || isCalendarViewMode) {
    sortBy = 'start_time'
  }
  const activePostsOnly = (querystringParams.activeOnly === 'true') || (!querystringParams.activeOnly && ((customView?.type === 'stream' && customView.activePostsOnly) || defaultActivePostsOnly))
  const childPostInclusion = querystringParams.c || defaultChildPostInclusion
  const timeframe = querystringParams.timeframe || 'future'

  const postTypesAvailable = useMemo(() => {
    if (customView?.type === 'stream') return customView?.postTypes
    if (systemView) return systemView?.postTypes
    return null
  }, [customView, systemView])

  const postTypeFilter = useMemo(() => querystringParams.t || postTypesAvailable?.[defaultPostType] ? defaultPostType : undefined, [querystringParams, defaultPostType])

  const topics = topic ? [topic.id] : customView?.type === 'stream' ? customView?.topics?.toModelArray().map(t => t.id) : []

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
        search,
        slug: groupSlug,
        sortBy,
        topics,
        types: postTypesAvailable
      }
    }

    const numPostsToLoad = isMobile.any ? 10 : 20

    const params = {
      activePostsOnly,
      childPostInclusion,
      context,
      filter: postTypeFilter,
      first: numPostsToLoad,
      forCollection: customView?.type === 'collection' ? customView?.collectionId : null,
      search,
      slug: groupSlug,
      sortBy,
      topics,
      types: postTypesAvailable
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
  }, [activePostsOnly, calendarDate, isCalendarViewMode, childPostInclusion, context, customView, groupSlug, postTypeFilter, search, sortBy, timeframe, topic?.id, topicName, view])

  let name = customView?.name || systemView?.name || 'Stream'
  let icon = customView?.icon || systemView?.iconName
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
  const posts = useMemo(() => postsSelector.map(p => presentPost(p, groupId)), [groupId, postsSelector])
  const hasMore = useSelector(state => getHasMorePosts(state, fetchPostsParam))
  const pending = useSelector(state => state.pending[FETCH_POSTS])

  const fetchPostsFrom = useCallback((offset) => {
    if (pending && offset > 0) return
    if (hasMore === false && offset > 0) return
    dispatch(fetchPosts({ offset, ...fetchPostsParam }))
  }, [dispatch, pending, hasMore, fetchPostsParam])

  const postDialogOpen = useMemo(
    () => /\/post\/\d+/.test(location.pathname),
    [location.pathname]
  )

  useEffect(() => {
    if (customViewId) {
      dispatch(fetchCustomView(customViewId))
    }
  }, [customViewId, dispatch])

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
    if (!((!customViewId || customView?.type === 'stream' || customView?.type === 'collection') && (!topicName || topic))) return

    const run = () => fetchPostsFrom(0)

    // When a post dialog is open over the stream, defer the list fetch so fetchPost
    // and PostDetail can claim the connection first; stream still warms in the background.
    if (postDialogOpen) {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(run, { timeout: 3000 })
        return () => window.cancelIdleCallback?.(id)
      }
      const id = setTimeout(run, 1200)
      return () => clearTimeout(id)
    }

    run()
  }, [fetchPostsParam, isDraftsView, postDialogOpen, fetchPostsFrom, customViewId, customView?.type, topicName, topic])

  useEffect(() => {
    if (!isCalendarViewMode || isDraftsView) return
    if (customViewId && customView?.type !== 'stream' && customView?.type !== 'collection') return
    if (topicName && !topic) return
    if (pending || hasMore !== true || posts.length === 0) return
    fetchPostsFrom(posts.length)
  }, [
    isCalendarViewMode,
    isDraftsView,
    customViewId,
    customView?.type,
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

  const ViewComponent = viewComponent[viewMode]
  const hasPostPrompt = currentUserHasMemberships && context !== CONTEXT_MY && view !== 'explore'
  // Calendar view applies on both `/events` (default) and `/stream?v=calendar`.
  // Default new-post type to event in calendar mode; `/events` list view uses COMMON_VIEWS postTypes.
  const postTypesForPrompt = useMemo(() => {
    if (view === 'events') return postTypesAvailable || ['event']
    if (isCalendarViewMode) return ['event']
    return postTypesAvailable
  }, [view, isCalendarViewMode, postTypesAvailable])

  const info = useMemo(() => {
    if (customView?.type === 'stream') {
      const topics = customView?.topics?.toModelArray()
      return (
        <div className='flex flex-row gap-2 items-center'>
          <span className='text-sm'>
            {t('Displaying')}:&nbsp;
            {customView?.activePostsOnly ? t('Only active') : ''}
          </span>

          {customView?.postTypes.length === 0 ? t('None') : customView?.postTypes.map((p, i) => <span key={i}><PostLabel key={p} type={p} className='align-middle mr-2' />{p}s&nbsp;</span>)}
          {topics.length > 0 && <div>{t('filtered by topics:')}</div>}
          {topics.length > 0 && topics.map(t => <span key={t.id}>#{t.name}</span>)}
        </div>
      )
    } else if (customView?.type === 'collection') {
      return t('Curated Post Collection')
    } else if (topicName) {
      return t('Filtered by topic #{{topicName}}', { topicName })
    }
    return null
  }, [customView, topicName])

  const noPostsMessage = view === 'events' ? t('No {{timeFrame}} events', { timeFrame: timeframe === 'future' ? t('upcoming') : t('past') }) : 'No posts'

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
      <Helmet>
        <title>{name} | {group ? `${group.name} | ` : context} | Hylo</title>
        <meta name='description' content={group ? `Posts from ${group.name}. ${group.description}` : 'Group Not Found'} />
      </Helmet>

      <Routes>
        <Route path='post/:postId' element={<PostDialog container={container} />} />
      </Routes>

      <div
        id='stream-inner-container'
        className={cn(
          'flex flex-col flex-1',
          !isCalendarViewMode && STREAM_MAIN_COLUMN_CLASS,
          isCalendarViewMode && 'w-full mx-auto p-1 sm:p-4'
        )}
      >
        {hasPostPrompt && !showPaywallBlock && (
          <PostPrompt
            avatarUrl={currentUser.avatarUrl}
            firstName={currentUser.firstName()}
            newPost={newPost}
            postTypesAvailable={postTypesForPrompt}
          />
        )}
        {!showPaywallBlock && (
          <ViewControls
            routeParams={routeParams} view={view} postTypeFilter={postTypeFilter} postTypesAvailable={postTypesAvailable} customViewType={customView?.type}
            sortBy={sortBy} viewMode={viewMode} searchValue={search}
            changePostTypeFilter={changePostTypeFilter} context={context} changeSort={changeSort} changeView={changeView} changeSearch={changeSearch}
            changeChildPostInclusion={changeChildPostInclusion} childPostInclusion={childPostInclusion}
            changeTimeframe={changeTimeframe} timeframe={timeframe} activePostsOnly={activePostsOnly} changeActivePostsOnly={changeActivePostsOnly}
          />
        )}
        {showPaywallBlock
          ? (
            <div className='mt-4'>
              <PaywallOfferingsSection group={group} />
            </div>
            )
          : (
            <>
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
                <MasonryGrid
                  enabled={viewMode === 'grid' || viewMode === 'bigGrid'}
                  gap={8}
                  className={cn(styles.streamItems, {
                    [styles.streamGrid]: viewMode === 'grid',
                    [styles.bigGrid]: viewMode === 'bigGrid',
                    'border-2 border-foreground/10 rounded-md bg-card overflow-hidden': viewMode === 'list'
                  })}
                >

                  {!pending && !topicBlockingStreams && !customViewLoading && posts.length === 0 ? <NoPosts message={noPostsMessage} /> : ''}

                  {posts.map(post => (
                    <ViewComponent
                      className={cn({ [styles.cardItem]: viewMode === 'cards' })}
                      routeParams={routeParams}
                      post={post}
                      group={group}
                      key={post.id}
                      currentGroupId={group && group.id}
                      currentUser={currentUser}
                      querystringParams={querystringParams}
                      childPost={isChildGroupPost({ context, groupSlug, post })}
                    />
                  ))}
                </MasonryGrid>
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
