import { cn } from 'util/index'
import { compact, get } from 'lodash/fp'
import { ChevronLeft, GripHorizontal, Pencil } from 'lucide-react'
import React, { useMemo, useState, useCallback } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCorners } from '@dnd-kit/core'

import GroupMenuHeader from 'components/GroupMenuHeader'
import Icon from 'components/Icon'
import WidgetIconResolver from 'components/WidgetIconResolver'
import NavLink from './NavLink'
import MenuLink from './MenuLink'
import TopicNavigation from './TopicNavigation'
import useRouteParams from 'hooks/useRouteParams'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { GROUP_TYPES } from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getChildGroups, getParentGroups } from 'store/selectors/getGroupRelationships'
import { getContextWidgets, orderContextWidgetsForContextMenu } from 'store/selectors/contextWidgetSelectors'
import getMe from 'store/selectors/getMe'
import { removeWidgetFromMenu, updateContextWidget } from 'store/actions/contextWidgets'
import resetNewPostCount from 'store/actions/resetNewPostCount'
import useGatherItems from 'hooks/useGatherItems'
import { CONTEXT_MY, FETCH_POSTS, RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { setConfirmBeforeClose } from 'routes/FullPageModal/FullPageModal.store'
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
    currentGroup,
    mapView
  } = props

  const dispatch = useDispatch()
  const routeParams = useRouteParams()
  const location = useLocation()
  const currentUser = useSelector(getMe)
  const { t } = useTranslation()

  const group = useSelector(state => currentGroup || getGroupForSlug(state, routeParams.groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const rootPath = baseUrl({ ...routeParams, view: null })
  const isAllOrPublicPath = ['/all', '/public'].includes(rootPath)
  const isPublic = routeParams.context === 'public'
  const isMyContext = routeParams.context === CONTEXT_MY
  const isAllContext = routeParams.context === 'all'
  const profileUrl = personUrl(get('id', currentUser), routeParams.groupSlug)

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
    if (isMyContext || isPublic || isAllContext) {
      return getStaticMenuWidgets({ isPublic, isMyContext, profileUrl, isAllContext })
    }
    return getContextWidgets(state, group)
  })

  const hasContextWidgets = useMemo(() => {
    if (group || isMyContext || isPublic || isAllContext) {
      return contextWidgets.length > 0
    }
    return false
  }, [group, isMyContext, isPublic, isAllContext])

  const orderedWidgets = useMemo(() => orderContextWidgetsForContextMenu(contextWidgets), [contextWidgets])

  const isEditting = getQuerystringParam('cme', location) === 'yes' && canAdminister

  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))
  const streamFetchPostsParam = useSelector(state => get('Stream.fetchPostsParam', state))

  const [isDragging, setIsDragging] = useState(false)
  const [activeWidget, setActiveWidget] = useState(null)
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])

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
  const decisionsPath = viewUrl('decisions', routeParams)

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
    decisionsPath && {
      label: t('Decisions'),
      icon: 'Proposal',
      to: decisionsPath
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
    <div className={cn('Navigation bg-background z-40 overflow-y-auto h-lvh min-w-280 border-r border-foreground/20 shadow-md', { [classes.mapView]: mapView }, { [classes.showGroupMenu]: isNavOpen }, className)}>
      <div className='ContextDetails w-full z-20 relative'>
        {routeParams.context === 'groups'
          ? <GroupMenuHeader group={group} />
          : isPublic
            ? (
              <div className='flex flex-col p-2'>
                <h2 className='text-foreground font-bold leading-3 text-lg'>The Commons</h2>
              </div>
              )
            : isMyContext || isAllContext
              ? (
                <div className='flex flex-col p-2'>
                  <h2 className='text-foreground font-bold leading-3 text-lg'>My Home</h2>
                </div>
                )
              : null}
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
                <MenuLink to={topicsUrl(routeParams)}>
                  <Icon name='Topics' />
                </MenuLink>
              </li>
            </ul>
          )}
          {canView && !isMyContext && !isPublic && !isAllContext && (
            <TopicNavigation
              backUrl={rootPath}
              routeParams={routeParams}
              groupId={group?.id}
              location={location}
            />
          )}
        </div>
      )}
      {hasContextWidgets && (
        <div className='relative translate-x-0 translate-y-0 flex flex-col items-center overflow-hidden z-20'>
          <Routes>
            <Route path='settings/*' element={<GroupSettingsMenu group={group} />} />
          </Routes>

          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div className='w-full'>
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
                <ContextMenuItem widget={activeWidget} isOverlay group={group} groupSlug={routeParams.groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditting={isEditting} isDragging={isDragging} />
              )}
              {activeWidget && activeWidget.parentId && (
                <ListItemRenderer isOverlay item={activeWidget} group={group} rootPath={rootPath} groupSlug={routeParams.groupSlug} canDnd={false} />
              )}
            </DragOverlay>
          </DndContext>
          {(!isMyContext && !isPublic && !isAllContext) && (
            <div className='px-2 w-full mb-[0.05em]'>
              <ContextMenuItem
                widget={{ title: 'widget-all', type: 'all-views', view: 'all-views', childWidgets: [] }}
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
      {isNavOpen && <div className={cn('ContextMenuCloseBg opacity-50 fixed right-0 top-0 w-full h-full z-10 transition-all duration-250 ease-in-out', { 'sm:block': isNavOpen })} onClick={toggleNavMenuAction} />}
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
          <Icon name='Plus' onClick={() => handlePositionedAdd({ id: 'bottom-of-list-' + groupSlug, addToEnd: true })} className='cursor-pointer' />
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
        <Icon name='Plus' onClick={() => handlePositionedAdd({ widget })} className='cursor-pointer' />
      </DropZone>
      <div key={widget.id} ref={setDraggableNodeRef} style={style} className='border-2 border-foreground/20 rounded-md p-2 bg-background text-foreground mb-[.5rem] '>
        {/* TODO CONTEXT: need to check this display logic for when someone wants a singular view (say, they pull projects out of the all view) */}
        {url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))
          ? (
            <span className='flex items-center content-center'>
              <WidgetIconResolver widget={widget} />
              <MenuLink to={url} externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}>
                <span className='text-base font-normal ml-2'>{title}</span>
              </MenuLink>
              {canDnd && isDroppable && <div className='ml-auto'><GrabMe {...listeners} {...attributes} /></div>}
            </span>
            )
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
                      <Icon name='Plus' onClick={() => handlePositionedAdd({ id: 'bottom-of-child-list' + widget.id, addToEnd: true, parentId: widget.id })} className='cursor-pointer' />
                    </DropZone>
                  </li>}
              </ul>
            </div>)}

      </div>
      {showEdit && (
        <div className='mb-[30px]'>
          <MenuLink to={addQuerystringToPath(url, { cme: 'yes' })} className='transition-all border-2 border-foreground/20 rounded-md p-2 bg-background text-foreground opacity-50 hover:opacity-100 flex items-center text-foreground hover:text-foreground'>
            <Pencil className='h-[16px]' />
            <span className='text-base'>{t('Edit Menu')}</span>
          </MenuLink>
        </div>
      )}
    </>
  )
}

function GrabMe ({ children, ...props }) {
  return (
    <span className='text-sm font-bold cursor-grab' {...props}>
      <GripHorizontal />
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
        <Icon name='Plus' onClick={() => handlePositionedAdd({ id: `${item.id}`, widget: item })} className='cursor-pointer' />
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
      <MenuLink to={groupUrl(group.slug, 'settings/invite')}>
        <div className='inline-block px-4 py-2 text-sm font-medium text-foreground bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'>
          {t('Add Members')}
        </div>
      </MenuLink>
    )
  }

  if (widget.type === 'about') {
    return (
      <div className='w-full'>
        <p className='text-sm text-gray-600 break-words w-[12.5rem] min-h-fit'>{group.purpose}</p>
        <p className='text-sm text-gray-600 break-words w-[12.5rem] min-h-fit'>{group.description}</p>
      </div>
    )
  }

  if (widget.type === 'setup') {
    const settingsUrl = groupUrl(group.slug, 'settings')

    const listItemComponent = ({ title, url }) => (
      <li className='border-2 border-foreground/20 rounded-md p-2 bg-background text-foreground mb-[.5rem]'>
        <MenuLink to={url} className='text-sm text-foreground'>
          {title}
        </MenuLink>
      </li>
    )

    return (
      <>
        <MenuLink to={groupUrl(group.slug, 'settings')}>
          <div className='inline-block px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer'>
            {t('Settings')}
          </div>
        </MenuLink>
        <ul className='mt-4 pl-0 w-full'>
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

const SETTINGS_MENU_ITEMS = [
  { title: 'Group Details', url: 'settings' },
  { title: 'Agreements', url: 'settings/agreements' },
  { title: 'Responsibilities', url: 'settings/responsibilities' },
  { title: 'Roles & Badges', url: 'settings/roles' },
  { title: 'Privacy & Access', url: 'settings/privacy' },
  { title: 'Topics', url: 'settings/topics' },
  { title: 'Invitations', url: 'settings/invite' },
  { title: 'Join Requests', url: 'settings/requests' },
  { title: 'Related Groups', url: 'settings/relationships' },
  { title: 'Export Data', url: 'settings/export' },
  { title: 'Delete', url: 'settings/delete' }
]

function GroupSettingsMenu ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  // XXX: hacky way to track the view we were at before opening the settings menu. also see locationHistory.js
  const previousLocation = useSelector(state => get('locationHistory.currentLocation', state))

  const confirm = useSelector(state => get('FullPageModal.confirm', state))

  const closeMenu = useCallback(() => {
    if (!confirm || window.confirm(t('You have unsaved changes, are you sure you want to leave?'))) {
      dispatch(setConfirmBeforeClose(false))
      navigate(previousLocation || groupUrl(group.slug))
    }
  }, [confirm, previousLocation, group.slug])

  return (
    <div className='fixed h-full w-full top-0 left-0 backdrop-blur-sm z-10'>
      <div className='absolute h-full w-[calc(100%-3.5em)] top-0 left-14 flex flex-col gap-2 bg-background rounded-t-lg shadow-xl border-t border-l border-2 border-border pl-3 pr-6'>
        <h3 className='text-lg font-bold flex items-center gap-2'>
          <ChevronLeft className='w-6 h-6 inline cursor-pointer' onClick={closeMenu} />
          {t('Group Settings')}
        </h3>
        <ul className='flex flex-col gap-2 p-0' onClick={() => { console.log('menu') }}>
          {SETTINGS_MENU_ITEMS.map(item => (
            <li key={item.url}>
              <MenuLink
                to={groupUrl(group.slug, item.url)}
                className={cn(
                  'inline-block w-full ml-2 mr-4 py-1 px-2 text-md text-foreground rounded-xl border-foreground/50 border-2 hover:border-secondary cursor-pointer',
                  { 'text-secondary border-secondary': location.pathname === groupUrl(group.slug, item.url) }
                )}
              >
                {item.title}
              </MenuLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
