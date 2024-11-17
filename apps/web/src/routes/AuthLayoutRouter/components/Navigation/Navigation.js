import cx from 'classnames'
import { compact, get } from 'lodash/fp'
import React, { useMemo, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import Icon from 'components/Icon'
import NavLink from './NavLink'
import MenuLink from './MenuLink'
import TopicNavigation from './TopicNavigation'
import { toggleGroupMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCenter } from '@dnd-kit/core'

import { GROUP_TYPES } from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getChildGroups, getParentGroups } from 'store/selectors/getGroupRelationships'
import { getContextWidgets, orderContextWidgetsForContextMenu } from 'store/selectors/contextWidgetSelectors'
import getMe from 'store/selectors/getMe'
import resetNewPostCount from 'store/actions/resetNewPostCount'
import useGatherItems from 'hooks/useGatherItems'
import { CONTEXT_MY, FETCH_POSTS, RESP_ADMINISTRATION } from 'store/constants'
import orm from 'store/models'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import { viewUrl, widgetUrl, baseUrl, topicsUrl } from 'util/navigation'

import classes from './Navigation.module.scss'
import { isWidgetDroppable, widgetTitleResolver } from 'util/contextWidgets'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'

const getGroupMembership = ormCreateSelector(
  orm,
  getMe,
  (state, { groupId }) => groupId,
  (session, currentUser, id) => session.Membership.filter({ group: id, person: currentUser }).first()
)

// TODO CONTEXT: this is the context menu, aka ContextMenu. Rename at the END of refractoring layout stuff, to avoid awkward merge conflicts
export default function Navigation (props) {
  const {
    className,
    collapsed,
    groupId,
    hideTopics,
    mapView,
    toggleGroupMenu
  } = props

  const dispatch = useDispatch()
  const routeParams = useParams()
  const location = useLocation()
  const { t } = useTranslation()

  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))

  const rootPath = baseUrl({ ...routeParams, view: null })
  const isAllOrPublicPath = ['/all', '/public'].includes(rootPath)

  // TODO CONTEXT: the new post count will be refactored into the use of highlightNumber and secondaryNumber, on the context widgets
  const badge = useSelector(state => {
    if (group) {
      const groupMembership = getGroupMembership(state, { groupId: group.id })
      return get('newPostCount', groupMembership)
    }
    return null
  })

  const hasRelatedGroups = useSelector(state => {
    if (group) {
      const childGroups = getChildGroups(state, group)
      const parentGroups = getParentGroups(state, group)
      return childGroups.length > 0 || parentGroups.length > 0
    }
    return false
  })

  const contextWidgets = useSelector(state => getContextWidgets(state, group))

  const hasContextWidgets = useMemo(() => {
    if (group) {
      return contextWidgets.length > 0
    }
    return false
  }, [group])

  const isEditting = getQuerystringParam('cme', location) === 'yes' && canAdminister

  const isGroupMenuOpen = useSelector(state => get('AuthLayoutRouter.isGroupMenuOpen', state))
  const streamFetchPostsParam = useSelector(state => get('Stream.fetchPostsParam', state))

  const [isDragging, setIsDragging] = useState(false)

  const dropPostResults = makeDropQueryResults(FETCH_POSTS)

  const clearStream = () => dispatch(dropPostResults(streamFetchPostsParam))
  const clearBadge = () => {
    if (badge && group) {
      dispatch(resetNewPostCount(group.id, 'Membership'))
    }
  }

  const homeOnClick = () => {
    if (window.location.pathname === rootPath) {
      clearStream()
      clearBadge()
    }
  }

  const createPath = `${location.pathname}/create${location.search}`
  const eventsPath = viewUrl('events', routeParams)
  const explorePath = !isAllOrPublicPath && viewUrl('explore', routeParams)
  const groupsPath = viewUrl('groups', routeParams)
  const streamPath = viewUrl('stream', routeParams)
  const mapPath = viewUrl('map', routeParams)
  const membersPath = !isAllOrPublicPath && viewUrl('members', routeParams)
  const projectsPath = viewUrl('projects', routeParams)
  const proposalPath = viewUrl('proposals', routeParams)

  const isPublic = routeParams.context === 'public'
  const isMyContext = routeParams.context === CONTEXT_MY

  const customViews = (group && group.customViews && group.customViews.toRefArray()) || []

  const myLinks = [
    createPath && {
      label: t('Create'),
      icon: 'Create',
      to: createPath
    },
    {
      label: t('My Posts'),
      icon: 'Posticon',
      to: '/my/posts'
    },
    {
      label: t('Interactions'),
      icon: 'Support',
      to: '/my/interactions'
    },
    {
      label: t('Mentions'),
      icon: 'Email',
      to: '/my/mentions'
    },
    {
      label: t('Announcements'),
      icon: 'Announcement',
      to: '/my/announcements'
    }
  ]

  const regularLinks = compact([
    createPath && {
      label: t('Create'),
      icon: 'Create',
      to: createPath
    },
    rootPath && {
      label: group && group.type === GROUP_TYPES.farm ? t('Home') : t('Stream'),
      icon: group && group.type === GROUP_TYPES.farm ? 'Home' : 'Stream',
      to: rootPath,
      badge,
      handleClick: homeOnClick,
      exact: true
    },
    streamPath && group && group.type === GROUP_TYPES.farm && {
      label: t('Stream'),
      icon: 'Stream',
      to: streamPath
    },
    explorePath && group && group.type !== GROUP_TYPES.farm && {
      label: t('Explore'),
      icon: 'Binoculars',
      to: explorePath
    },
    projectsPath && {
      label: t('Projects'),
      icon: 'Projects',
      to: projectsPath
    },
    eventsPath && {
      label: t('Events'),
      icon: 'Events',
      to: eventsPath
    },
    membersPath && {
      label: t('Members'),
      icon: 'People',
      to: membersPath
    },
    proposalPath && {
      label: t('Decisions'),
      icon: 'Proposal',
      to: proposalPath
    },
    (hasRelatedGroups || isPublic) && groupsPath && {
      label: isPublic ? t('Group Explorer') : t('Groups'),
      icon: 'Groups',
      to: groupsPath
    },
    mapPath && {
      label: t('Map'),
      icon: 'Globe',
      to: mapPath
    },
    ...customViews.filter(cv => cv.name && (cv.type !== 'externalLink' || cv.externalLink)).map(cv => ({
      label: cv.name,
      icon: cv.icon,
      to: cv.type !== 'externalLink' ? `${rootPath}/custom/${cv.id}` : false,
      externalLink: cv.type === 'externalLink' ? cv.externalLink : false
    }))
  ])

  const handleDragStart = () => {
    setIsDragging(true)
    console.log('drag start')
  }
  const handleDragEnd = () => {
    setIsDragging(false)
    if (event.over && event.over.id === 'droppable') {
      console.log('dropped over', event.over)
    }
    console.log('drag end')
  }
  console.log('isDraggingssss', isDragging)
  const collapserState = collapsed ? 'collapserCollapsed' : 'collapser'
  const canView = !group || group.memberCount !== 0
  const links = isMyContext ? myLinks : regularLinks
  return (
    <div className={cx(classes.container, { [classes.mapView]: mapView }, classes[collapserState], { [classes.showGroupMenu]: isGroupMenuOpen }, className)}>
      {!hasContextWidgets && (
        <div className={classes.navigation}>
          {canView && (
            <ul className={classes.links} id='groupMenu'>
              {links.map((link, i) => (
                <NavLink
                  key={link.label + i}
                  externalLink={link.externalLink}
                  {...link}
                  collapsed={collapsed}
                  onClick={link.handleClick}
                />
              ))}
              <li className={cx(classes.item, classes.topicItem)}>
                <Link to={topicsUrl(routeParams)}>
                  <Icon name='Topics' />
                </Link>
              </li>
            </ul>
          )}
          {!hideTopics && canView && !isMyContext && (
            <TopicNavigation
              collapsed={collapsed}
              backUrl={rootPath}
              routeParams={routeParams}
              groupId={groupId}
              location={location}
            />
          )}
        </div>
      )}
      {hasContextWidgets && (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
          <ContextWidgetList isDragging={isDragging} isEditting={isEditting} contextWidgets={contextWidgets} groupSlug={routeParams.groupSlug} rootPath={rootPath} canAdminister={canAdminister} />
          <div className='absolute bottom-0 w-[calc(100%-2em)] p-2 ml-8 mb-[0.05em]'>
            <ContextMenuItem widget={{ title: 'widget-all', type: 'grid-view', view: 'grid-view', childWidgets: [] }} groupSlug={routeParams.groupSlug} rootPath={rootPath} canAdminister={canAdminister} allView isEditting={isEditting} />
          </div>
        </DndContext>
      )}
      {!hasContextWidgets && <div className={classes.closeBg} onClick={toggleGroupMenu} />}
    </div>
  )
}

function ContextWidgetList ({ contextWidgets, groupSlug, rootPath, canAdminister, isEditting, isDragging }) {
  const orderedWidgets = useMemo(() => orderContextWidgetsForContextMenu(contextWidgets), [contextWidgets])

  return (
    <ul>
      {orderedWidgets.map(widget => (
        <li key={widget.id}><ContextMenuItem widget={widget} groupSlug={groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditting={isEditting} isDragging={isDragging} /></li>
      ))}
    </ul>
  )
}

function ContextMenuItem ({ widget, groupSlug, rootPath, canAdminister = false, isEditting = false, allView = false, isDragging = false }) {
  const { t } = useTranslation()
  const { listItems, loading } = useGatherItems({ widget, groupSlug })

  const isDroppable = isWidgetDroppable({ widget })

  // Draggable setup
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform } = useDraggable({ id: widget.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  const title = widgetTitleResolver({ widget, t })
  const url = widgetUrl({ widget, rootPath, groupSlug, context: 'group' })
  const canDnd = !allView && isEditting && widget.type !== 'home'
  const showEdit = allView && canAdminister

  // Check if the widget should be rendered
  if (!['members', 'setup'].includes(widget.type) && !widget.view && widget.childWidgets.length === 0 &&
      !widget.viewGroup && !widget.viewUser && !widget.viewPost &&
      !widget.viewChat && !widget.customView) {
    return null
  }

  // Check admin visibility
  if (widget.visibility === 'admin' && !canAdminister) {
    return null
  }

  return (
    <>
      <DropZone isDragging={isDragging} isDroppable={isDroppable} droppableParams={{ id: `${widget.id}-top`, data: { order: widget.order } }} />
      <div key={widget.id} ref={setDraggableNodeRef} style={style} className='border border-gray-700 rounded-md p-2 bg-white'>
        {/* TODO CONTEXT: need to check this display logic for when someone wants a singular view (say, they pull projects out of the all view) */}
        {url && (widget.childWidgets.length === 0 && !['members'].includes(widget.type))
          ? (
            <span className='flex justify-between items-center content-center'>
              <MenuLink to={url} externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}>
                <span className='text-lg font-bold'>{title}</span>
              </MenuLink>
              {showEdit &&
                <MenuLink to={url + '?cme=yes'}>
                  <span className='text-lg font-bold'>{t('Edit')}</span>
                </MenuLink>}
              {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
            </span>)
          : (
            <div>
              {widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <MenuLink to={url}> <h3 className='text-sm font-semibold'>{title}</h3></MenuLink>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {!widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <h3 className='text-sm font-semibold'>{title}</h3>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {/* Special elements can be added here */}
              <ul>
                {loading && <li key='loading'>Loading...</li>}
                {listItems.length > 0 && listItems.map(item => <ListItemRenderer key={item.id} item={item} rootPath={rootPath} groupSlug={groupSlug} isDragging={isDragging} canDnd={canDnd} />)}
              </ul>
            </div>)}
      </div>
      <DropZone isDragging={isDragging} isDroppable={isDroppable} droppableParams={{ id: `${widget.id}-bottom`, data: { order: widget.order + 1 } }} />
    </>
  )
}

function GrabMe ({ children, ...props }) {
  return (
    <span className='text-sm font-bold' {...props}>
      {children || 'Grab me'}
    </span>
  )
}

function DropZone ({ droppableParams, isDroppable = false, isDragging = false }) {
  const { isOver, setNodeRef } = useDroppable(droppableParams)
  return (
    <div ref={setNodeRef} className={`bg-green-100 ${isDroppable && isDragging ? 'h-2' : ''} ${isOver ? 'h-5 transition-height' : ''}`} />
  )
}

function ListItemRenderer ({ item, rootPath, groupSlug, canDnd }) {
  const { t } = useTranslation()
  const itemTitle = widgetTitleResolver({ widget: item, t })
  const itemUrl = widgetUrl({ widget: item, rootPath, groupSlug, context: 'group' })

  const isItemDraggable = isWidgetDroppable({ widget: item }) && canDnd
  // this is the hook problem. Need to move this out
  const { attributes: itemAttributes, listeners: itemListeners, setNodeRef: setItemDraggableNodeRef, transform: itemTransform } = useDraggable({ id: item.id })
  const itemStyle = itemTransform ? { transform: `translate3d(${itemTransform.x}px, ${itemTransform.y}px, 0)` } : undefined

  return (
    <React.Fragment key={item.id + itemTitle}>
      <DropZone isDroppable={isItemDraggable} droppableParams={{ id: `${item.id}-top`, data: { order: item.order, parentId: item.parentId } }} />
      <li ref={setItemDraggableNodeRef} style={itemStyle} className='flex justify-between items-center content-center'>
        <MenuLink to={itemUrl} externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}>
          <span className='text-sm text-blue-500 underline'>{itemTitle}</span>
        </MenuLink>
        {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
      </li>
      <DropZone isDroppable={isItemDraggable} droppableParams={{ id: `${item.id}-bottom`, data: { order: item.order + 1, parentId: item.parentId } }} />
    </React.Fragment>
  )
}

// Needed attributes:
// type
// title
// order
// visibility
// icon
// view
// viewChat
// childWidgets
// viewPost
// viewGroup
// viewUser
// customView

// const homeWidget = await ContextWidget.forge({
//   group_id: this.id,
//   type: 'home',
//   title: 'widget-home',
//   order: 1,
//   created_at: new Date(),
//   updated_at: new Date()
// }).save(null, { transacting: trx })

// // Create hearth widget as child of home
// await ContextWidget.forge({
//   group_id: this.id,
//   title: 'widget-hearth',
//   view_chat_id: generalTag.id,
//   parent_id: homeWidget.id,
//   order: 1,
//   created_at: new Date(),
//   updated_at: new Date()
// }).save(null, { transacting: trx })

// const orderedWidgets = [
//   { title: 'widget-chats', type: 'chats', order: 2 },
//   { title: 'widget-auto-view', type: 'auto-view', order: 3 },
//   { title: 'widget-members', type: 'members', view: 'members', order: 4 },
//   { title: 'widget-setup', type: 'setup', visibility: 'admin', order: 5 },
//   { title: 'widget-custom-views', type: 'custom-views', order: 6 },
// ]

// // These are accessible in the all view
// const unorderedWidgets = [
//   { title: 'widget-discussions', view: 'discussions' }, // non-typed widgets have no special behavior
//   { title: 'widget-ask-and-offer', view: 'ask-and-offer' },
//   { title: 'widget-stream', view: 'stream' },
//   { title: 'widget-events', type: 'events', view: 'events' },
//   { title: 'widget-projects', type: 'projects', view: 'projects' },
//   { title: 'widget-groups', type: 'groups', view: 'groups' },
//   { title: 'widget-decisions', type: 'decisions', view: 'decisions' },
//   { title: 'widget-about', type: 'about', view: 'about' },
//   { title: 'widget-map', type: 'map', view: 'map' }
// ]
