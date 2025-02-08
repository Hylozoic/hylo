import { cn } from 'util/index'
import { get, isEmpty } from 'lodash/fp'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { Routes, Route, useLocation } from 'react-router-dom'
import { push } from 'redux-first-history'
import { createSelector as ormCreateSelector } from 'redux-orm'

import { COMMON_VIEWS } from '@hylo/presenters/ContextWidgetPresenter'
import Loading from 'components/Loading'
import ModerationListItem from 'components/ModerationListItem/ModerationListItem'
import NoPosts from 'components/NoPosts'
import Calendar from 'components/Calendar'
import PostDialog from 'components/PostDialog'
import PostListRow from 'components/PostListRow'
import PostCard from 'components/PostCard'
import PostGridItem from 'components/PostGridItem'
import PostBigGridItem from 'components/PostBigGridItem'
import PostLabel from 'components/PostLabel'
import PostPrompt from './PostPrompt'
import ScrollListener from 'components/ScrollListener'
import ViewControls from 'components/StreamViewControls'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { updateUserSettings } from 'routes/UserSettings/UserSettings.store'
import changeQuerystringParam from 'store/actions/changeQuerystringParam'
import fetchGroupTopic from 'store/actions/fetchGroupTopic'
import fetchTopic from 'store/actions/fetchTopic'
import fetchPosts from 'store/actions/fetchPosts'
import { fetchModerationActions, clearModerationAction } from 'store/actions/moderationActions'
// import toggleGroupTopicSubscribe from 'store/actions/toggleGroupTopicSubscribe'
import { FETCH_MODERATION_ACTIONS, FETCH_POSTS, FETCH_TOPIC, FETCH_GROUP_TOPIC, CONTEXT_MY, VIEW_MENTIONS, VIEW_ANNOUNCEMENTS, VIEW_INTERACTIONS, VIEW_POSTS } from 'store/constants'
import orm from 'store/models'
import presentPost from 'store/presenters/presentPost'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
// import getGroupTopicForCurrentRoute from 'store/selectors/getGroupTopicForCurrentRoute'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { getHasMorePosts, getPosts } from 'store/selectors/getPosts'
import getTopicForCurrentRoute from 'store/selectors/getTopicForCurrentRoute'
import isPendingFor from 'store/selectors/isPendingFor'
import { getHasMoreModerationActions, getModerationActions } from 'store/selectors/getModerationActions'
import { createPostUrl } from 'util/navigation'

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

export default function Stream (props) {
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()
  const { t } = useTranslation()
  const { groupSlug, topicName, customViewId } = routeParams
  const context = props.context

  const [container, setContainer] = useState(null)

  const view = props.view || routeParams.view

  const currentUser = useSelector(getMe)
  const currentUserHasMemberships = useSelector(state => !isEmpty(getMyMemberships(state)))
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupId = group?.id || 0
  const topic = useSelector(state => getTopicForCurrentRoute(state, topicName))

  const systemView = COMMON_VIEWS[view]
  const customView = useSelector(state => getCustomView(state, customViewId))

  const topicLoading = useSelector(state => isPendingFor([FETCH_TOPIC, FETCH_GROUP_TOPIC], state))

  const defaultSortBy = systemView?.defaultSortBy || get('settings.streamSortBy', currentUser) || 'created'
  const defaultViewMode = systemView?.defaultViewMode || get('settings.streamViewMode', currentUser) || 'cards'
  const defaultPostType = systemView?.defaultPostType || get('settings.streamPostType', currentUser) || undefined
  const defaultChildPostInclusion = get('settings.streamChildPosts', currentUser) || systemView?.defaultChildPostInclusion || 'yes'

  const querystringParams = getQuerystringParam(['s', 't', 'v', 'c', 'search', 'timeframe'], location)

  const search = querystringParams.search
  let sortBy = querystringParams.s || customView?.defaultSort || defaultSortBy
  if (!customView && sortBy === 'order') {
    sortBy = 'updated'
  }
  if (view === 'events') {
    sortBy = 'start_time'
  }
  const viewMode = querystringParams.v || customView?.defaultViewMode || defaultViewMode
  const calendarView = viewMode === 'calendar'
  const decisionView = getQuerystringParam('d', location) || 'decisions'
  const childPostInclusion = querystringParams.c || defaultChildPostInclusion
  const timeframe = querystringParams.timeframe || 'future'

  // TODO: merge this and getTypes
  const determinePostTypeFilter = useCallback(() => {
    if (view === 'projects') return 'project'
    if (view === 'decisions') return 'proposal'
    if (view === 'events') return 'event'
    return querystringParams.t || defaultPostType
  }, [querystringParams, defaultPostType, view])

  const postTypeFilter = determinePostTypeFilter()

  const getTypes = useCallback(({ customView }) => {
    if (customView?.type === 'stream') return customView?.postTypes
    if (systemView) return systemView?.postTypes
    return null
  }, [systemView])

  const topics = topic ? [topic.id] : customView?.type === 'stream' ? customView?.topics?.toModelArray().map(t => t.id) : []

  const fetchPostsParam = useMemo(() => {
    const params = {
      activePostsOnly: customView?.type === 'stream' ? customView?.activePostsOnly : false,
      childPostInclusion,
      context,
      filter: postTypeFilter,
      forCollection: customView?.type === 'collection' ? customView?.collectionId : null,
      search,
      slug: groupSlug,
      sortBy,
      topics,
      types: getTypes({ customView, view })
    }
    if (view === 'events' && !calendarView) {
      params.afterTime = timeframe === 'future' ? new Date().toISOString() : undefined
      params.beforeTime = timeframe === 'past' ? new Date().toISOString() : undefined
      params.order = timeframe === 'future' ? 'asc' : 'desc'
    }
    return params
  }, [childPostInclusion, context, customView, groupSlug, postTypeFilter, timeframe, topic?.id, topicName, sortBy, search, view, calendarView])

  let name = customView?.name || systemView?.name || ''
  let icon = customView?.icon || systemView?.iconName
  if (topicName) {
    name = '#' + topicName
  }

  if (context === CONTEXT_MY) {
    switch (view) {
      case VIEW_MENTIONS:
        name = 'Mentions'
        icon = 'Email'
        fetchPostsParam.mentionsOf = [currentUser.id]
        break
      case VIEW_ANNOUNCEMENTS:
        name = 'Announcements'
        icon = 'Announcement'
        fetchPostsParam.announcementsOnly = true
        break
      case VIEW_INTERACTIONS:
        name = 'Interactions'
        icon = 'Support'
        fetchPostsParam.interactedWithBy = [currentUser.id]
        break
      case VIEW_POSTS:
        name = 'Posts'
        icon = 'Posticon'
        fetchPostsParam.createdBy = [currentUser.id]
        break
    }
  }

  const postsSelector = useSelector((state) => getPosts(state, fetchPostsParam))
  const posts = useMemo(() => postsSelector.map(p => presentPost(p, groupId)), [groupId, postsSelector])
  const hasMore = useSelector(state => getHasMorePosts(state, fetchPostsParam))
  const pending = useSelector(state => state.pending[FETCH_POSTS])
  const pendingModerationActions = useSelector(state => state.pending[FETCH_MODERATION_ACTIONS])

  const fetchModerationActionParam = {
    slug: groupSlug,
    groupId,
    sortBy
  }
  const moderationActions = useSelector(state => {
    return decisionView === 'moderation' ? getModerationActions(state, fetchModerationActionParam) : []
  }, (prevModerationActions, nextModerationActions) => {
    if (prevModerationActions.length !== nextModerationActions.length) return false
    return prevModerationActions.every((item, index) => item.id === nextModerationActions[index].id && item.status === nextModerationActions[index].status)
  })
  const hasMoreModerationActions = useSelector(state => decisionView === 'moderation' ? getHasMoreModerationActions(state, fetchModerationActionParam) : false)

  const fetchModerationActionsAction = useCallback((offset) => {
    if (pendingModerationActions || hasMoreModerationActions === false) return
    return dispatch(fetchModerationActions({ offset, ...fetchModerationActionParam }))
  }, [pendingModerationActions, hasMoreModerationActions, fetchModerationActionParam])

  const fetchPostsFrom = useCallback((offset) => {
    if (pending || hasMore === false) return
    dispatch(fetchPosts({ offset, ...fetchPostsParam }))
  }, [pending, hasMore, fetchPostsParam])

  // TODO: fetch custom view inc ase it has been updated?

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
    if (decisionView === 'moderation') {
      fetchModerationActionsAction(0)
    } else if ((!customViewId || customView?.type === 'stream') && (!topicName || topic)) {
      // Fetch posts, unless the custom view has not fully loaded yet, or the topic has not fully loaded yet
      fetchPostsFrom(0)
    }
  }, [fetchPostsParam, decisionView])

  const changeTab = useCallback(tab => {
    dispatch(updateUserSettings({ settings: { streamPostType: tab || '' } }))
    dispatch(changeQuerystringParam(location, 't', tab, 'all'))
  }, [location])

  const changeSort = useCallback(sort => {
    dispatch(updateUserSettings({ settings: { streamSortBy: sort } }))
    dispatch(changeQuerystringParam(location, 's', sort, 'all'))
  }, [location])

  const changeView = useCallback(view => {
    dispatch(updateUserSettings({ settings: { streamViewMode: view } }))
    dispatch(changeQuerystringParam(location, 'v', view, 'all'))
  }, [location])

  const changeChildPostInclusion = useCallback(childPostsBool => {
    dispatch(updateUserSettings({ settings: { streamChildPosts: childPostsBool } }))
    dispatch(changeQuerystringParam(location, 'c', childPostsBool, 'yes'))
  }, [location])

  const changeSearch = useCallback(search => {
    dispatch(changeQuerystringParam(location, 'search', search, 'all'))
  }, [location])

  const changeDecisionView = useCallback(view => {
    dispatch(changeQuerystringParam(location, 'd', view, 'proposals'))
  }, [location])

  const changeTimeframe = useCallback(timeframe => {
    dispatch(changeQuerystringParam(location, 'timeframe', timeframe, 'future'))
  }, [location])

  const newPost = useCallback(() => dispatch(push(createPostUrl(routeParams, querystringParams))), [routeParams, querystringParams])

  const ViewComponent = viewComponent[viewMode]
  const hasPostPrompt = currentUserHasMemberships && context !== CONTEXT_MY && view !== 'explore'

  const info = customView?.type === 'stream'
    ? (
      <div className='flex flex-row gap-2 items-center'>
        <span className='text-sm'>
          {t('Displaying')}:&nbsp;
          {customView?.activePostsOnly ? t('Only active') : ''}
        </span>

        {customView?.postTypes.length === 0 ? t('None') : customView?.postTypes.map((p, i) => <span key={i}><PostLabel key={p} type={p} className='align-middle mr-1' />{p}s&nbsp;</span>)}
        {customView?.topics.length > 0 && <div>{t('filtered by topics:')}</div>}
        {customView?.topics.length > 0 && customView?.topics.map(t => <span key={t.id}>#{t.name}</span>)}
      </div>
      )
    : customView?.type === 'collection'
      ? t('Curated Post Collection')
      : topicName
        ? t('Filtered by topic #{{topicName}}', { topicName })
        : null

  const noPostsMessage = view === 'events' ? t('No {{timeFrame}} events', { timeFrame: timeframe === 'future' ? t('upcoming') : t('past') }) : 'No posts'

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: name,
      icon,
      info,
      search: true
    })
  }, [name, icon, info])

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
          !calendarView && 'max-w-[750px]',
          'flex flex-col flex-1 w-full mx-auto overflow-auto p-4'
        )}
      >
        {hasPostPrompt && (
          <PostPrompt
            avatarUrl={currentUser.avatarUrl}
            firstName={currentUser.firstName()}
            newPost={newPost}
            querystringParams={querystringParams}
            routeParams={routeParams}
            type={postTypeFilter}
          />
        )}
        <ViewControls
          routeParams={routeParams} view={view} customPostTypes={customView?.type === 'stream' ? customView?.postTypes : null} customViewType={customView?.type}
          postTypeFilter={postTypeFilter} sortBy={sortBy} viewMode={viewMode} searchValue={search}
          changeTab={changeTab} context={context} changeSort={changeSort} changeView={changeView} changeSearch={changeSearch}
          changeChildPostInclusion={changeChildPostInclusion} childPostInclusion={childPostInclusion}
          decisionView={decisionView} changeDecisionView={changeDecisionView} changeTimeframe={changeTimeframe} timeframe={timeframe}
        />
        {decisionView !== 'moderation' && !calendarView && (
          <div className={cn(styles.streamItems, { [styles.streamGrid]: viewMode === 'grid', [styles.bigGrid]: viewMode === 'bigGrid' })}>
            {!pending && !topicLoading && posts.length === 0 ? <NoPosts message={noPostsMessage} /> : ''}
            {posts.map(post => {
              const groupSlugs = post.groups.map(group => group.slug)
              return (
                <ViewComponent
                  className={cn({ [styles.cardItem]: viewMode === 'cards' })}
                  routeParams={routeParams}
                  post={post}
                  group={group}
                  key={post.id}
                  currentGroupId={group && group.id}
                  currentUser={currentUser}
                  querystringParams={querystringParams}
                  childPost={![CONTEXT_MY, 'all', 'public'].includes(context) && !groupSlugs.includes(groupSlug)}
                />
              )
            })}
          </div>
        )}
        {decisionView === 'moderation' && !calendarView && (
          <div className='streamItems'>
            {!pendingModerationActions && moderationActions.length === 0 ? <NoPosts /> : ''}
            {moderationActions.map(modAction => {
              return (
                <ModerationListItem
                  group={group}
                  key={modAction.id}
                  moderationAction={modAction}
                  handleClearModerationAction={() => dispatch(clearModerationAction({ postId: modAction?.post?.id, moderationActionId: modAction?.id, groupId: group?.id }))}
                />
              )
            })}
          </div>
        )}
        {!pending && calendarView && (
          <div className='calendarView'>
            <Calendar
              posts={posts}
              routeParams={routeParams}
              querystringParams={querystringParams}
            />
          </div>
        )}
        {(pending || topicLoading) && <Loading />}

        <ScrollListener
          onBottom={() => fetchPostsFrom(posts.length)}
          elementId='stream-outer-container'
        />
      </div>
    </div>
  )
}
