import { cn } from 'util'
import { compact, get } from 'lodash/fp'
import React, { useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCorners } from '@dnd-kit/core'

import Icon from 'components/Icon'
import WidgetIconResolver from 'components/WidgetIconResolver'
import NavLink from './NavLink'
import MenuLink from './MenuLink'
import TopicNavigation from './TopicNavigation'
import useRouteParams from 'hooks/useRouteParams'
import { toggleGroupMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { GROUP_TYPES } from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getChildGroups, getParentGroups } from 'store/selectors/getGroupRelationships'
import { getContextWidgets, orderContextWidgetsForContextMenu } from 'store/selectors/contextWidgetSelectors'
import getMe from 'store/selectors/getMe'
import { removeWidgetFromMenu, updateContextWidget } from 'store/actions/contextWidgets'
import resetNewPostCount from 'store/actions/resetNewPostCount'
import useGatherItems from 'hooks/useGatherItems'
import { CONTEXT_MY, FETCH_POSTS, RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import orm from 'store/models'
import { makeDropQueryResults } from 'store/reducers/queryResults'
import { viewUrl, widgetUrl, baseUrl, topicsUrl, groupUrl, addQuerystringToPath, personUrl } from 'util/navigation'

import classes from './ContextMenu.module.scss'
import { getStaticMenuWidgets, isWidgetDroppable, widgetIsValidChild, widgetTitleResolver } from 'util/contextWidgets'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import logout from 'store/actions/logout'

const getGroupMembership = ormCreateSelector(
  orm,
  getMe,
  (state, { groupId }) => groupId,
  (session, currentUser, id) => session.Membership.filter({ group: id, person: currentUser }).first()
)

export default function ContextMenu (props) {
  const {
    className,
    groupId,
    mapView
  } = props

  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const location = useLocation()
  const currentUser = useSelector(getMe)
  const { t } = useTranslation()

  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const rootPath = baseUrl({ ...routeParams, view: null })
  const isAllOrPublicPath = ['/all', '/public'].includes(rootPath)
  const isPublic = routeParams.context === 'public'
  const isMyContext = routeParams.context === CONTEXT_MY
  const profileUrl = personUrl(get('id', currentUser))

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

  const contextWidgets = useSelector(state => {
    if (isMyContext || isPublic) {
      return getStaticMenuWidgets({ isPublic, isMyContext, profileUrl })
    }
    return getContextWidgets(state, group)
  })

  const hasContextWidgets = useMemo(() => {
    if (group || isMyContext || isPublic) {
      return contextWidgets.length > 0
    }
    return false
  }, [group, isMyContext, isPublic])

  const orderedWidgets = useMemo(() => orderContextWidgetsForContextMenu(contextWidgets), [contextWidgets])

  const isEditting = getQuerystringParam('cme', location) === 'yes' && canAdminister

  const isGroupMenuOpen = useSelector(state => get('AuthLayoutRouter.isGroupMenuOpen', state))
  const streamFetchPostsParam = useSelector(state => get('Stream.fetchPostsParam', state))

  const [isDragging, setIsDragging] = useState(false)
  const [activeWidget, setActiveWidget] = useState(null)
  const toggleGroupMenuAction = useCallback(() => dispatch(toggleGroupMenu()), [])

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

  const customViews = (group && group.customViews && group.customViews.toRefArray()) || []

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
    (hasRelatedGroups) && groupsPath && {
      label: t('Groups'),
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

  const handleDragStart = ({ active }) => {
    setIsDragging(true)

    const activeId = active.id
    const activeContextWidget = orderedWidgets.find(widget => widget.id === activeId) || contextWidgets.find(widget => widget.id === activeId)

    setActiveWidget(activeContextWidget)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setIsDragging(false)
    if (over && over.id !== active.id && over.id !== 'remove') {
      const orderInFrontOfWidget = over.data?.current?.widget
      dispatch(updateContextWidget({
        contextWidgetId: active.id,
        groupId: group.id,
        data: {
          orderInFrontOfWidgetId: orderInFrontOfWidget?.id,
          parentId: over.data.current?.widget?.parentId || over.data?.current?.parentId,
          addToEnd: over.data?.current?.addToEnd,
          remove: over.id === 'remove'
        }
      }))
    }
    if (over.id === 'remove') {
      dispatch(removeWidgetFromMenu({ contextWidgetId: active.id, groupId: group.id }))
    }
    setActiveWidget(null)
  }

  const canView = !group || group.memberCount !== 0
  const links = regularLinks
  return (
    <div className={cn('Navigation bg-background z-40 overflow-y-auto h-lvh min-w-280', { [classes.mapView]: mapView }, { [classes.showGroupMenu]: isGroupMenuOpen }, className)}>
      <div className='ContextDetails h-190 w-full flex items-end'>
        <div className='flex flex-col p-2'>
          <h2 className='text-foreground font-bold leading-3 text-lg'>Group Name</h2>
          <span className={cn('text-xs')}>312 Members</span>
        </div>
      </div>
      {!hasContextWidgets && (
        <div className={classes.navigation}>
          {canView && (
            <ul className={classes.links} id='groupMenu'>
              {links.map((link, i) => (
                <NavLink
                  key={link.label + i}
                  externalLink={link.externalLink}
                  {...link}
                  onClick={link.handleClick}
                />
              ))}
              <li className={cn(classes.item, classes.topicItem)}>
                <Link to={topicsUrl(routeParams)}>
                  <Icon name='Topics' />
                </Link>
              </li>
            </ul>
          )}
          {canView && !isMyContext && !isPublic && (
            <TopicNavigation
              backUrl={rootPath}
              routeParams={routeParams}
              groupId={groupId}
              location={location}
            />
          )}
        </div>
      )}
      {hasContextWidgets && (
        <div className='flex flex-col content-center'>
          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div>
              <ContextWidgetList
                isDragging={isDragging}
                isEditting={isEditting}
                contextWidgets={orderedWidgets}
                groupSlug={routeParams.groupSlug}
                rootPath={rootPath}
                canAdminister={canAdminister}
                activeWidget={activeWidget}
                group={group}
              />
            </div>
            <DragOverlay>
              {activeWidget && !activeWidget.parentId && (
                <ContextMenuItem widget={activeWidget} isOverlay groupSlug={routeParams.groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditting={isEditting} isDragging={isDragging} />
              )}
              {activeWidget && activeWidget.parentId && (
                <ListItemRenderer isOverlay item={activeWidget} rootPath={rootPath} groupSlug={routeParams.groupSlug} canDnd={false} />
              )}
            </DragOverlay>
          </DndContext>
          {(!isMyContext && !isPublic) && (
            <div className='w-[calc(100%-1.5em)] ml-[1.5em] p-2 mb-[0.05em]'>
              <ContextMenuItem
                widget={{ title: 'widget-all', type: 'grid-view', view: 'grid-view', childWidgets: [] }}
                groupSlug={routeParams.groupSlug}
                rootPath={rootPath}
                canAdminister={canAdminister}
                allView
                isEditting={isEditting}
                group={group}
              />
            </div>)}
        </div>
      )}
      {!hasContextWidgets && <div className={classes.closeBg} onClick={toggleGroupMenuAction} />}
    </div>
  )
}

function ContextWidgetList ({ contextWidgets, groupSlug, rootPath, canAdminister, isEditting, isDragging, activeWidget, group }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handlePositionedAdd = ({ widget, addToEnd, parentId }) => {
    navigate(addQuerystringToPath(location.pathname, { addview: 'yes', cme: 'yes', parentId: widget?.parentId || parentId, orderInFrontOfWidgetId: widget?.id || null }))
  }

  return (
    <ul className='m-2 p-0'>
      {isEditting &&
        <DropZone isDragging={isDragging} height='h-16' droppableParams={{ id: 'remove' }}>
          Drag here to remove from menu
        </DropZone>}
      {contextWidgets.map(widget => (
        <li className='mb-2 items-start' key={widget.id}><ContextMenuItem widget={widget} groupSlug={groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditting={isEditting} isDragging={isDragging} activeWidget={activeWidget} group={group} handlePositionedAdd={handlePositionedAdd} /></li>
      ))}
      <li className='mb-2'>
        <DropZone isDragging={isDragging} hide={!isEditting} height='h-20' isDroppable droppableParams={{ id: 'bottom-of-list-' + groupSlug, data: { addToEnd: true, parentId: null } }}>
          <Icon name='Plus' onClick={() => handlePositionedAdd({ id: 'bottom-of-list-' + groupSlug, addToEnd: true })} />
        </DropZone>
      </li>
    </ul>
  )
}

function ContextMenuItem ({ widget, groupSlug, rootPath, canAdminister = false, isEditting = false, allView = false, isDragging = false, isOverlay = false, activeWidget, group, handlePositionedAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { listItems, loading } = useGatherItems({ widget, groupSlug })

  const isDroppable = isWidgetDroppable({ widget })
  const isCreating = widget.id === 'creating'

  const handleLogout = async () => {
    dispatch(replace('/login', null))
    await dispatch(logout())
  }

  // Draggable setup
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform } = useDraggable({ id: widget.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  const title = widgetTitleResolver({ widget, t })
  const url = widgetUrl({ widget, rootPath, groupSlug })
  const canDnd = !allView && isEditting && widget.type !== 'home'
  const showEdit = allView && canAdminister
  const hideDropZone = isOverlay || allView || !canDnd
  const isInvalidChild = !widgetIsValidChild({ childWidget: activeWidget, parentWidget: widget })
  const hideBottomDropZone = ['setup'].includes(widget.type)

  if (isCreating) {
    return (
      <div className='border border-gray-700 rounded-md p-2 bg-white'>
        <h3 className='text-sm font-semibold'>{t('creatingWidget')}</h3>
      </div>
    )
  }

  // Check if the widget should be rendered
  if (!['members', 'setup'].includes(widget.type) && !isEditting && !widget.view && widget.childWidgets.length === 0 &&
      !widget.viewGroup && !widget.viewUser && !widget.viewPost &&
      !widget.viewChat && !widget.customView) {
    return null
  }

  // Check admin visibility
  if (widget.visibility === 'admin' && !canAdminister) {
    return null
  }

  if (activeWidget && activeWidget.id === widget.id) {
    return null
  }

  if (widget.type === 'logout') {
    return (
      <div key={widget.id} style={style} className='border border-gray-700 rounded-md p-2 bg-white'>
        <span className='flex justify-between items-center content-center'>
          <WidgetIconResolver widget={widget} />
          <MenuLink onClick={handleLogout}>
            <span className='text-lg font-bold'>{title}</span>
          </MenuLink>
        </span>
      </div>
    )
  }

  return (
    <>
      <DropZone isDragging={isDragging} height={isDroppable && isEditting ? 'h-5' : ''} hide={hideDropZone} droppableParams={{ id: `${widget.id}`, data: { widget } }}>
        <Icon name='Plus' onClick={() => handlePositionedAdd({ widget })} />
      </DropZone>
      <div key={widget.id} ref={setDraggableNodeRef} style={style} className='border-2 border-foreground/20 rounded-md p-2 bg-background text-foreground '>
        {/* TODO CONTEXT: need to check this display logic for when someone wants a singular view (say, they pull projects out of the all view) */}
        {url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))
          ? (
            <span className='flex items-center content-center'>
              <WidgetIconResolver widget={widget} />
              <MenuLink to={url} externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}>
                <span className='text-sm font-bold ml-2'>{title}</span>
              </MenuLink>
              {showEdit &&
                <MenuLink to={addQuerystringToPath(url, { cme: 'yes' })}>
                  <span className='text-lg font-bold'>{t('Edit')}</span>
                </MenuLink>}
              {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
            </span>)
          : (
            <div>
              {widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <MenuLink to={url} externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}> <h3 className='text-sm font-semibold text-foreground'>{title}</h3></MenuLink>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {!widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              <div className='flex flex-col justify-center items-center relative'>
                <SpecialTopElementRenderer widget={widget} group={group} />
              </div>
              <ul>
                {loading && <li key='loading'>Loading...</li>}
                {listItems.length > 0 && listItems.map(item => <ListItemRenderer key={item.id} item={item} rootPath={rootPath} groupSlug={groupSlug} isDragging={isDragging} canDnd={canDnd} activeWidget={activeWidget} invalidChild={isInvalidChild} handlePositionedAdd={handlePositionedAdd} />)}
                {widget.id &&
                  <li>
                    <DropZone isDragging={isDragging} hide={hideDropZone || hideBottomDropZone} isDroppable={canDnd && !url} height='h-12' droppableParams={{ id: 'bottom-of-child-list' + widget.id, data: { addToEnd: true, parentId: widget.id } }}>
                      <Icon name='Plus' onClick={() => handlePositionedAdd({ id: 'bottom-of-child-list' + widget.id, addToEnd: true, parentId: widget.id })} />
                    </DropZone>
                  </li>}
              </ul>
            </div>)}
      </div>
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

function DropZone ({ droppableParams, isDroppable = true, height = '', hide = false, children }) {
  const { setNodeRef } = useDroppable(droppableParams)

  if (hide || !isDroppable) {
    return null
  }
  // TODO CONTEXT: remove isDragging or actually use it
  return (
    <div ref={setNodeRef} className={`bg-green-100 ${isDroppable && height} ${droppableParams.id === 'remove' && 'bg-orange-300'}`}>
      {children}
    </div>
  )
}

function ListItemRenderer ({ item, rootPath, groupSlug, canDnd, isOverlay = false, activeWidget, invalidChild = false, handlePositionedAdd }) {
  const { t } = useTranslation()
  const itemTitle = widgetTitleResolver({ widget: item, t })
  const itemUrl = widgetUrl({ widget: item, rootPath, groupSlug, context: 'group' })
  let hideDropZone = isOverlay

  const isItemDraggable = isWidgetDroppable({ widget: item }) && canDnd
  const { attributes: itemAttributes, listeners: itemListeners, setNodeRef: setItemDraggableNodeRef, transform: itemTransform } = useDraggable({ id: item.id })
  const itemStyle = itemTransform ? { transform: `translate3d(${itemTransform.x}px, ${itemTransform.y}px, 0)` } : undefined

  if (activeWidget && activeWidget.id === item.id) {
    hideDropZone = true
    return null
  }

  return (
    <React.Fragment key={item.id + itemTitle}>
      <DropZone height={isItemDraggable ? 'h-8' : ''} hide={hideDropZone || invalidChild || !canDnd} droppableParams={{ id: `${item.id}`, data: { widget: item } }}>
        <Icon name='Plus' onClick={() => handlePositionedAdd({ id: `${item.id}`, widget: item })} />
      </DropZone>
      <li ref={setItemDraggableNodeRef} style={itemStyle} className='flex justify-between items-center content-center'>
        <WidgetIconResolver widget={item} />
        <MenuLink to={itemUrl} externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}>
          <span className='text-sm text-blue-500 underline'>{itemTitle}</span>
        </MenuLink>
        {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
      </li>
    </React.Fragment>
  )
}

function SpecialTopElementRenderer ({ widget, group }) {
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))
  const { t } = useTranslation()

  if (widget.type === 'members' && canAddMembers) {
    return (
      <Link to={groupUrl(group.slug, 'settings/invite')}>
        <div className='inline-block px-4 py-2 text-sm font-medium text-foreground bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'>
          {t('Add Members')}
        </div>
      </Link>
    )
  }

  if (widget.type === 'about') {
    return (
      <>
        <p className='text-sm text-gray-600 break-words w-[12.5rem] min-h-fit'>{group.purpose}</p>
        <p className='text-sm text-gray-600 break-words w-[12.5rem] min-h-fit'>{group.description}</p>
      </>
    )
  }

  if (widget.type === 'setup') {
    const settingsUrl = groupUrl(group.slug, 'settings')

    const listItemComponent = ({ title, url }) => (
      <li className='py-2 px-2 border'>
        <Link to={url} className='text-sm text-foreground'>
          {title}
        </Link>
      </li>
    )

    return (
      <>
        <Link to={groupUrl(group.slug, 'settings')}>
          <div className='inline-block px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'>
            {t('Settings')}
          </div>
        </Link>
        <ul className='mt-4'>
          {!group.avatarUrl && listItemComponent({
            title: t('Add Avatar'),
            url: settingsUrl
          })}
          {!group.bannerUrl && listItemComponent({
            title: t('Add Banner'),
            url: settingsUrl
          })}
          {!group.purpose && listItemComponent({
            title: t('Add Purpose'),
            url: settingsUrl
          })}
          {!group.description && listItemComponent({
            title: t('Add Description'),
            url: settingsUrl
          })}
          {!group.locationObject && listItemComponent({
            title: t('Add Location'),
            url: settingsUrl
          })}
        </ul>
      </>
    )
  }

  return null
}
