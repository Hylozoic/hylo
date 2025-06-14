import { DndContext, DragOverlay, useDroppable, useDraggable, closestCorners } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { get } from 'lodash/fp'
import { ChevronLeft, Copy, GripHorizontal, Pencil, UserPlus, LogOut, Users, House, Trash } from 'lucide-react'
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { createSelector } from 'reselect'

import ContextWidgetPresenter, {
  isValidDropZone,
  getStaticMenuWidgets,
  orderContextWidgetsForContextMenu,
  isHiddenInContextMenuResolver,
  translateTitle,
  allViewsWidget
} from '@hylo/presenters/ContextWidgetPresenter'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG, TextHelpers } from '@hylo/shared'

import GroupMenuHeader from 'components/GroupMenuHeader'
import HyloHTML from 'components/HyloHTML'
import Icon from 'components/Icon'
import WidgetIconResolver from 'components/WidgetIconResolver'
import MenuLink from './MenuLink'
import useGatherItems from 'hooks/useGatherItems'
import useRouteParams from 'hooks/useRouteParams'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { setConfirmBeforeClose } from 'routes/FullPageModal/FullPageModal.store'
import { removeWidgetFromMenu, updateContextWidget, setHomeWidget } from 'store/actions/contextWidgets'
import logout from 'store/actions/logout'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getContextWidgets } from 'store/selectors/contextWidgetSelectors'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION, RESP_MANAGE_TRACKS } from 'store/constants'
import { bgImageStyle, cn } from 'util/index'
import { widgetUrl, baseUrl, groupUrl, groupInviteUrl, addQuerystringToPath, personUrl } from 'util/navigation'

import { useContextMenuContext } from './ContextMenuContext'
import ContextMenuProvider from './ContextMenuProvider'

import classes from './ContextMenu.module.scss'

let previousWidgetIds = []
let isAddingChildWidget = false

const getStaticMenuWidgetsMemoized = createSelector(
  [
    (_, params) => params.isPublicContext,
    (_, params) => params.isMyContext,
    (_, params) => params.profileUrl
  ],
  (isPublicContext, isMyContext, profileUrl) =>
    getStaticMenuWidgets({ isPublicContext, isMyContext, profileUrl })
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
  const navigate = useNavigate()

  const groupSlug = routeParams.groupSlug
  const group = useSelector(state => currentGroup || getGroupForSlug(state, groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const rootPath = baseUrl({ ...routeParams, view: null })
  const isPublicContext = routeParams.context === PUBLIC_CONTEXT_SLUG
  const isMyContext = routeParams.context === MY_CONTEXT_SLUG
  const isAllContext = routeParams.context === ALL_GROUPS_CONTEXT_SLUG
  const profileUrl = personUrl(get('id', currentUser), groupSlug)

  const rawContextWidgets = useSelector(state => {
    if (isMyContext || isPublicContext || isAllContext) {
      return getStaticMenuWidgetsMemoized(state, {
        isPublicContext,
        isMyContext: isMyContext || isAllContext,
        profileUrl
      })
    }
    return getContextWidgets(state, group)
  })

  const contextWidgets = useMemo(() => {
    return rawContextWidgets.map(widget => ContextWidgetPresenter(widget))
  }, [rawContextWidgets, t])

  const hasContextWidgets = useMemo(() => {
    if (group || isMyContext || isPublicContext || isAllContext) {
      return contextWidgets.length > 0
    }
    return false
  }, [group, isMyContext, isPublicContext, isAllContext])

  const orderedWidgets = useMemo(() => {
    return orderContextWidgetsForContextMenu(contextWidgets)
  }, [contextWidgets])

  const isEditing = getQuerystringParam('cme', location) === 'yes' && canAdminister

  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))

  const [activeWidget, setActiveWidget] = useState(null)
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])

  const currentWidgetIds = useMemo(() =>
    orderedWidgets.map(widget =>
      [widget.id, widget.childWidgets?.map(childWidget => childWidget.id)]
    ).flat().flat(),
  [orderedWidgets])
  const newWidgetId = useMemo(() => previousWidgetIds.length > 0
    ? currentWidgetIds.find(widgetId => previousWidgetIds.indexOf(widgetId) === -1)
    : null,
  [currentWidgetIds])
  previousWidgetIds = currentWidgetIds
  const newWidgetRef = useRef()

  useEffect(() => {
    if (isEditing) {
      const element = document.querySelector('.ContextMenu')
      element.scrollTop = element.scrollHeight
    }
  }, [isEditing])

  useEffect(() => {
    if (newWidgetRef.current) {
      const element = newWidgetRef.current

      if (!isAddingChildWidget) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      isAddingChildWidget = false

      // animate the new widget to draw attention to it
      element.classList.remove('animate-slide-up')
      element.classList.remove('invisible')
      element.classList.add('animate-pulsate')
      setTimeout(() => {
        element.classList.remove('animate-pulsate')
      }, 2500)
    }
  }, [newWidgetId])

  const handlePositionedAdd = ({ widget, addToEnd, parentId }) => {
    isAddingChildWidget = true
    navigate(addQuerystringToPath(location.pathname, { addview: 'yes', cme: 'yes', parentId: widget?.parentId || parentId, orderInFrontOfWidgetId: widget?.id || null }))
  }

  const handleDragStart = ({ active }) => {
    const activeContextWidget = orderedWidgets.find(widget => widget.id === active.id) || contextWidgets.find(widget => widget.id === active.id)
    setActiveWidget(activeContextWidget)
  }

  const handleDragCancel = (event) => {
    setActiveWidget(null)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && over.id !== active.id && over.id !== 'remove') {
      const orderInFrontOfWidget = over.data?.current?.addToEnd ? null : over.data?.current?.widget

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

    if (over && over.id === 'remove') {
      dispatch(removeWidgetFromMenu({ contextWidgetId: active.id, groupId: group.id }))
    }

    setActiveWidget(null)
  }

  return (
    <ContextMenuProvider
      contextWidgets={orderedWidgets}
      activeWidget={activeWidget}
      isEditing={isEditing}
      canAdminister={canAdminister}
      rootPath={rootPath}
      group={group}
      groupSlug={groupSlug}
      handlePositionedAdd={handlePositionedAdd}
    >
      <div className={cn('ContextMenu bg-background z-20 overflow-y-auto h-lvh w-[300px] shadow-md', { [classes.mapView]: mapView }, { [classes.showGroupMenu]: isNavOpen }, className)}>
        <div className='ContextDetails w-full z-20 relative'>
          {routeParams.context === 'groups'
            ? <GroupMenuHeader group={group} />
            : isPublicContext
              ? (
                <div className='TheCommonsHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md'>
                  <div className='absolute inset-0 z-10 bg-cover' style={{ ...bgImageStyle('/the-commons.jpg'), opacity: 0.5 }} />
                  <div className='absolute top-0 left-0 w-full h-full bg-theme-background z-0' />
                  {/* <div style={bgImageStyle('/the-commons.jpg')} className='rounded-lg h-10 w-10 mr-2 shadow-md bg-cover bg-center' /> */}
                  <div className='flex flex-col text-foreground drop-shadow-md overflow-hidden relative z-20'>
                    <h2 className='text-white font-bold leading-3 text-lg drop-shadow-md'>{t('The Commons')}</h2>
                  </div>
                </div>
                )
              : isMyContext
                ? (
                  <div className='flex flex-col p-2'>
                    <h2 className='text-foreground font-bold leading-3 text-lg'>{t('My Home')}</h2>
                  </div>
                  )
                : null}
        </div>
        {hasContextWidgets && (
          <div className='relative flex flex-col items-center overflow-hidden z-20'>
            <Routes>
              <Route path='settings/*' element={<GroupSettingsMenu group={group} />} />
            </Routes>

            <DndContext
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              collisionDetection={closestCorners}
              modifiers={[restrictToVerticalAxis]}
            >
              <div className='w-full'>
                <ContextWidgetList newWidgetId={newWidgetId} newWidgetRef={newWidgetRef} />
              </div>
              <DragOverlay wrapperElement='ul' dropAnimation={null}>
                {activeWidget && !activeWidget.parentId && (
                  <ContextMenuItem widget={activeWidget} isOverlay />
                )}
                {activeWidget && activeWidget.parentId && (
                  <ListItemRenderer item={activeWidget} isOverlay canDnd={false} />
                )}
              </DragOverlay>
            </DndContext>
            {(!isMyContext && !isPublicContext && !isAllContext) && (
              <div className='px-2 w-full mb-[0.05em] mt-6'>
                <ContextMenuItem widget={allViewsWidget} />
              </div>
            )}
          </div>
        )}
        {isNavOpen && <div className={cn('ContextMenuCloseBg opacity-50 fixed right-0 top-0 w-full h-full z-10 transition-all duration-250 ease-in-out', { 'sm:block': isNavOpen })} onClick={toggleNavMenuAction} />}
      </div>
    </ContextMenuProvider>
  )
}

function ContextWidgetList ({ newWidgetId, newWidgetRef }) {
  const { t } = useTranslation()
  const { contextWidgets, groupSlug, isEditing, handlePositionedAdd } = useContextMenuContext()

  const itemProps = {}
  if (newWidgetId) {
    itemProps[newWidgetId] = { ref: newWidgetRef }
  }

  return (
    <ul className='m-2 p-0 mb-6'>
      {isEditing &&
        <li>
          <DropZone removalDropZone droppableParams={{ id: 'remove' }}>
            {t('Drag here to remove from menu')}
          </DropZone>
        </li>}
      {contextWidgets.map((widget, index) => (
        <li
          className={`ContextMenuContextWidgetListItem items-start animate-slide-up invisible ${
            widget.childWidgets?.length > 0 ||
            ['container', 'home', 'chats', 'members'].includes(widget.type)
              ? 'mb-6 mt-6'
              : (isEditing ? 'mb-2' : 'mb-0')
          }`}
          style={{ '--delay': `${index * 35}ms` }}
          key={widget.id || index}
          {...itemProps[widget.id]}
        >
          <ContextMenuItem widget={widget} />
        </li>
      ))}
      {isEditing && (
        <>
          <li>
            <button onClick={() => handlePositionedAdd({ widget: { id: `bottom-of-list-${groupSlug}` }, addToEnd: true })} className='cursor-pointer text-sm text-foreground/40 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-background mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
              <Icon name='Plus' /> {t('Add new view')}
            </button>
          </li>
          <li>
            <DropZone droppableParams={{ id: 'bottom-of-menu', data: { addToEnd: true } }}>
              &nbsp;
            </DropZone>
          </li>
        </>
      )}
    </ul>
  )
}

function ContextMenuItem ({ widget, isOverlay = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { activeWidget, isEditing, canAdminister, rootPath, groupSlug, handlePositionedAdd } = useContextMenuContext()
  const { listItems, loading } = useGatherItems({ widget, groupSlug })

  const presentedlistItems = useMemo(() => {
    return listItems.map(widget => ContextWidgetPresenter(widget))
  }, [listItems])

  const isDroppable = widget.isDroppable
  const isCreating = widget.id === 'creating'

  const handleLogout = async () => {
    dispatch(replace('/login', null))
    await dispatch(logout())
  }

  // Draggable setup
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform } = useDraggable({ id: widget.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined

  const title = translateTitle(widget.title, t)
  const url = widgetUrl({ widget, rootPath, groupSlug })
  const allView = widget.type === 'all-views'
  const showEdit = allView && canAdminister
  const canDnd = isEditing && !allView && widget.type !== 'home'

  if (isCreating) {
    return (
      <div className='border border-gray-700 rounded-md p-2 bg-white'>
        <h3 className='text-sm font-semibold'>{t('creatingWidget')}</h3>
      </div>
    )
  }

  // Check if the widget should be rendered
  if (isHiddenInContextMenuResolver(widget) && !isEditing) {
    return null
  }

  // Check admin visibility
  if (widget.visibility === 'admin' && !canAdminister) {
    return null
  }

  // don't render the active widget, unless it's the overlay
  if (!isOverlay && activeWidget && activeWidget.id === widget.id) {
    return null
  }

  if (widget.type === 'logout') {
    return (
      <div key={widget.id} className='ContextMenu ContextWidgetMenuItemLogout mt-6'>
        <span className='flex justify-between items-center content-center'>
          <WidgetIconResolver widget={widget} />
          <MenuLink onClick={handleLogout} className='text-sm text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex'>
            <LogOut className='h-[20px] mr-2' /> <span>{title}</span>
          </MenuLink>
        </span>
      </div>
    )
  }

  return (
    <>
      {widget.id !== 'all-views' &&
        <DropZone droppableParams={{ id: widget.id, data: { widget, isOverlay } }}>
          &nbsp;
        </DropZone>}
      <div key={widget.id} ref={setDraggableNodeRef} style={style}>
        {url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))
          ? (
            <>
              <MenuLink
                to={url}
                externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}
                className='ContextWidgetMenuLink flex text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full flex items-center justify-between transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 group'
              >
                <div className='flex-1 flex items-center'>
                  <WidgetIconResolver widget={widget} />
                  <span className='text-base font-normal ml-2 flex-1'>{title}</span>
                  {!widget.viewTrack?.didComplete && widget.viewTrack?.isEnrolled ? <span className='text-sm ml-2'>{t('Enrolled')}</span> : null}
                  {widget.viewTrack?.didComplete ? <span className='text-sm ml-2'>{t('Completed')}</span> : null}
                </div>
                {canDnd && isDroppable && <div className='hidden group-hover:block'><ActionMenu widget={widget} className={cn('ml-2')} /></div>}
                {canDnd && isDroppable && <div className=''><GrabMe {...listeners} {...attributes} /></div>}
              </MenuLink>
            </>
            )
          : (
            <div>
              {widget.view &&
                <span className='flex justify-between items-center content-center group'>
                  <MenuLink
                    to={url}
                    externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}
                    badgeCount={widget.highlightNumber}
                  >
                    <h3 className='text-base font-light opacity-50 text-foreground' data-testid={widget.type}>{title}</h3>
                  </MenuLink>
                  {canDnd && isDroppable && <div className='hidden group-hover:block'><ActionMenu widget={widget} className={cn('ml-2')} /></div>}
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {!widget.view &&
                <span className='flex justify-between items-center content-center group'>
                  <h3 className='text-base font-light opacity-50 text-foreground' data-testid={widget.type}>{title}</h3>
                  {canDnd && isDroppable && <div className='hidden group-hover:block'><ActionMenu widget={widget} className={cn('ml-2')} /></div>}
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {widget.type !== 'members' && !isOverlay &&
                <div className={cn('flex flex-col relative transition-all text-foreground text-foreground hover:text-foreground',
                  {
                    'border-2 border-dashed border-foreground/20 rounded-md p-1 bg-background': isEditing && widget.type !== 'home'
                  })}
                >
                  <SpecialTopElementRenderer widget={widget} />
                  <ul className='p-0'>
                    {loading && <li key='loading'>Loading...</li>}
                    {presentedlistItems.length > 0 && !isOverlay && presentedlistItems.map(item => <ListItemRenderer key={item.id} item={item} widget={widget} canDnd={canDnd} />)}
                    {widget.id && isEditing && !['home', 'setup'].includes(widget.type) &&
                      <li>
                        <DropZone droppableParams={{ id: `bottom-of-child-list-${widget.id}`, data: { widget, parentWidget: widget, isOverlay, addToEnd: true, parentId: widget.id } }}>
                          &nbsp;
                        </DropZone>
                        <button onClick={() => handlePositionedAdd({ id: `bottom-of-child-list-${widget.id}`, addToEnd: true, parentId: widget.id })} className={cn('cursor-pointer text-base text-foreground/40 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100')}>
                          <Icon name='Plus' />
                          {widget.type === 'chats' ? <span> {t('Add new chat')}</span> : <span> {t('Add new view')}</span>}
                        </button>
                      </li>}
                  </ul>
                </div>}
              {widget.type === 'members' && !isOverlay &&
                <div className='ContextWidgetMenuItemMembers flex flex-col relative transition-all border-2 border-foreground/20 rounded-md bg-background text-foreground text-foreground hover:text-foreground'>
                  <SpecialTopElementRenderer widget={widget} />
                  <ul className='px-1 pt-1 pb-2'>
                    {loading && presentedlistItems.length === 0 && <li key='loading'>Loading...</li>}
                    {presentedlistItems.length > 0 && presentedlistItems.map(item => <ListItemRenderer key={item.id} item={item} widget={widget} canDnd={canDnd} />)}
                  </ul>
                </div>}
            </div>)}

      </div>
      {showEdit && (
        <div className='mb-[30px]'>
          <MenuLink to={addQuerystringToPath(url, { cme: isEditing ? 'no' : 'yes' })} className='flex items-center text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
            <Pencil className='h-[16px]' />
            <span className='text-base'>{isEditing ? t('Done Editing') : t('Edit Menu')}</span>
          </MenuLink>
        </div>
      )}
    </>
  )
}

function ActionMenu ({ widget }) {
  const { t } = useTranslation()
  const { group } = useContextMenuContext()
  const navigate = useNavigate()

  const dispatch = useDispatch()

  const handleEditWidget = useCallback((e) => {
    e.preventDefault()

    if (widget.type === 'customView') {
      navigate(groupUrl(group.slug, 'settings/views'))
    } else {
      const url = window.location.pathname
      const editWidgetUrl = addQuerystringToPath(url, { 'edit-widget-id': widget.id, cme: 'yes' })
      navigate(editWidgetUrl)
    }
  }, [widget.id, group.id])

  const handleRemoveWidget = useCallback((e) => {
    e.preventDefault()
    if (window.confirm(t('Are you sure you want to remove {{name}} from the menu?', { name: translateTitle(widget.title, t) }))) {
      dispatch(removeWidgetFromMenu({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [widget.id, group.id])

  const handleWidgetHomePromotion = useCallback((e) => {
    e.preventDefault()

    if (window.confirm(t('Are you sure you want to set this widget as the home/default widget for this group?'))) {
      dispatch(setHomeWidget({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [widget.id, group.id])

  return (
    <span className='text-sm font-bold cursor-pointer flex items-center'>
      {widget.isEditable && <Pencil onClick={handleEditWidget} />}
      <Trash onClick={handleRemoveWidget} />
      {widget.isValidHomeWidget && <House onClick={handleWidgetHomePromotion} />}
    </span>
  )
}

function GrabMe ({ children, ...props }) {
  return (
    <span className='text-sm font-bold cursor-grab' {...props}>
      <GripHorizontal />
    </span>
  )
}

function DropZone ({ droppableParams, children, removalDropZone }) {
  const { setNodeRef, isOver } = useDroppable(droppableParams)
  const { data } = droppableParams
  const { activeWidget, isEditing } = useContextMenuContext()

  if (!activeWidget && !removalDropZone) {
    return null
  }

  const { widget, parentWidget, isOverlay } = data || {}
  if (!isValidDropZone({ overWidget: widget, activeWidget, parentWidget, isOverlay, isEditing, droppableParams })) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200 rounded-lg overflow-hidden',
        !isOver && !removalDropZone && 'h-0',
        isOver && !removalDropZone && 'h-[8px] min-h-[40px] mb-1 bg-selected/70 hover:bg-foreground/20',
        !isOver && removalDropZone && 'bg-destructive/20 border-2 border-foreground p-5 min-h-[40px]',
        isOver && removalDropZone && 'bg-destructive/70 p-5 min-h-[40px]'
      )}
    >
      {children}
    </div>
  )
}

function ListItemRenderer ({ item, widget, canDnd, isOverlay = false }) {
  const { t } = useTranslation()
  const itemTitle = translateTitle(item.title, t)
  const { activeWidget, rootPath, groupSlug } = useContextMenuContext()
  const itemUrl = widgetUrl({ widget: item, rootPath, groupSlug })

  const isItemDraggable = item.isDroppable && canDnd
  const { attributes: itemAttributes, listeners: itemListeners, setNodeRef: setItemDraggableNodeRef, transform: itemTransform } = useDraggable({ id: item.id })
  const itemStyle = itemTransform ? { transform: `translate3d(${itemTransform.x}px, ${itemTransform.y}px, 0)` } : undefined

  // don't render the active widget, unless it's the overlay
  if (!isOverlay && activeWidget && activeWidget.id === item.id) {
    return null
  }

  // XXX why is this using parseInt? convert to luxon?
  const minute = 1000 * 60
  const isActive = item.viewUser?.lastActiveAt ? new Date(parseInt(item.viewUser.lastActiveAt)) > new Date(Date.now() - minute * 4) : false
  return (
    <React.Fragment key={item.id}>
      <DropZone droppableParams={{ id: item.id, data: { widget: item, parentWidget: widget, isOverlay } }}>
        &nbsp;
      </DropZone>
      <li ref={setItemDraggableNodeRef} style={itemStyle} className='flex justify items-center content-center animate-slide-up invisible'>
        {(() => {
          if (item.type === 'chat') {
            return (
              <MenuLink
                badgeCount={item.highlightNumber}
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='ContextWidgetMenuItemChat flex text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-between group'
              >
                <div className='flex-1 flex items-center'>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-1'>{itemTitle}</span>
                </div>
                {isItemDraggable && <div className='hidden group-hover:block'><ActionMenu widget={item} className={cn('ml-2')} /></div>}
                {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
              </MenuLink>
            )
          } else if ((rootPath !== '/my' && rootPath !== '/all' && !item.title) || (item.type === 'viewUser')) {
            return (
              <MenuLink
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='transition-all px-2 py-1 pb-2 text-foreground scale-1 hover:scale-110 scale-100 hover:text-foreground opacity-80 hover:opacity-100 flex align-items justify-between group'
              >
                <div className='flex items-center'>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-2'>
                    {itemTitle}
                    {isActive && <span className='w-2 h-2 ml-2 inline-block rounded-full bg-green-500' />}
                  </span>
                </div>
                {isItemDraggable && <div className='hidden group-hover:block'><ActionMenu widget={item} className={cn('ml-2')} /></div>}
                {isItemDraggable && <div className='hidden group-hover:block'><GrabMe {...itemListeners} {...itemAttributes} /></div>}
              </MenuLink>
            )
          } else if (rootPath === '/my' || rootPath === '/all' || rootPath !== '/members' || (item.title && item.type !== 'chat')) {
            return (
              <MenuLink
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='ContextWidgetMenuItem flex text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-between group'
              >
                <div className='flex-1 flex items-center'>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-2'>{itemTitle}</span>
                </div>
                {isItemDraggable && <div className='hidden group-hover:block'><ActionMenu widget={item} className={cn('ml-2')} /></div>}
                {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
              </MenuLink>
            )
          }
        })()}
      </li>
    </React.Fragment>
  )
}

function SpecialTopElementRenderer ({ widget }) {
  const { t } = useTranslation()
  const { isEditing, group, groupSlug } = useContextMenuContext()
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))

  const handleCopyInviteLink = useCallback((e) => {
    e.preventDefault()
    navigator.clipboard.writeText(groupInviteUrl(group))

    // Add flash effect
    const target = e.currentTarget
    target.classList.add('bg-secondary/30')
    target.innerText = t('Copied!')

    // Reset after animation
    setTimeout(() => {
      target.classList.remove('bg-secondary/30')
      target.innerText = t('Copy Link')
    }, 1500)
  }, [group])

  if (widget.type === 'members' && canAddMembers) {
    return (
      <div className='relative'>
        <div className={cn('absolute -top-10 right-0 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md bg-background text-foreground mb-[.5rem] transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100', isEditing && 'right-8')}>
          <MenuLink to={groupUrl(groupSlug, 'members')} className='flex items-center gap-2 px-2 py-1 text-foreground/50 hover:text-foreground/100 transition-all'>
            <Users className='w-4 h-4' />
            <span>{group.memberCount || 0}</span>
          </MenuLink>
        </div>
        <MenuLink to={groupUrl(groupSlug, 'settings/invite')}>
          <div className='flex items-center px-2 py-2 text-base font-medium text-foreground bg-foreground/20 rounded-sm mb-2 w-full rounded-bl-none rounded-br-none hover:bg-foreground/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer animate-slide-up invisible'>
            <UserPlus className='inline-block h-[20px] mr-1' />
            <span className='flex-1'>{t('Add Members')}</span>
            <span
              className='text-xs flex items-center gap-1 text-foreground/50 hover:text-foreground/100 transition-all border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-1 bg-background text-foreground transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'
              onClick={handleCopyInviteLink}
            >
              {t('Copy Link')} <Copy className='w-4 h-4' />
            </span>
          </div>
        </MenuLink>
      </div>
    )
  }

  if (widget.type === 'members' && !canAddMembers) {
    return (
      <div className='relative'>
        <div className={cn('absolute -top-10 right-0 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md bg-background text-foreground mb-[.5rem] transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100', isEditing && 'right-8')}>
          <MenuLink to={groupUrl(group.slug, 'members')} className='flex items-center gap-2 px-2 py-1 text-foreground/50 hover:text-foreground/100 transition-all'>
            <Users className='w-4 h-4' />
            <span>{group.memberCount || 0}</span>
          </MenuLink>
        </div>
      </div>
    )
  }

  if (widget.type === 'about') {
    return (
      <div className='w-full mb-8'>
        {group.purpose && <p className='px-3 text-xs text-foreground/50 hover:text-foreground/100 transition-all w-[255px] text-ellipsis overflow-hidden m-0 mb-2'><HyloHTML element='span' html={TextHelpers.markdown(group.purpose)} /></p>}
        {group.description && <p className='px-3 text-xs text-foreground/50 hover:text-foreground/100 transition-all w-[255px] text-ellipsis overflow-hidden m-0'><HyloHTML element='span' html={TextHelpers.markdown(group.description)} /></p>}
      </div>
    )
  }

  if (widget.type === 'setup') {
    const settingsUrl = groupUrl(groupSlug, 'settings')

    const listItemComponent = ({ title, url }) => (
      <li className='w-full animate-slide-up invisible'>
        <MenuLink to={url} className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
          {title}
        </MenuLink>
      </li>
    )

    return (
      <div className='mb-2'>
        <MenuLink to={groupUrl(groupSlug, 'settings')}>
          <div className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 animate-slide-up invisible'>
            {t('Settings')}
          </div>
        </MenuLink>
        <ul className='mt-0 pl-0 w-full'>
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
          {(!group.description || group.description === 'This is a long-form description of the group') && listItemComponent({
            title: t('Add Description'),
            url: settingsUrl
          })}
          {!group.locationObject && listItemComponent({
            title: t('Add Location'),
            url: settingsUrl
          })}
        </ul>
      </div>
    )
  }

  return null
}

function GroupSettingsMenu ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { groupSlug } = useContextMenuContext()

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))
  const canManageTracks = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_TRACKS, groupId: group?.id }))

  // XXX: hacky way to track the view we were at before opening the settings menu. also see locationHistory.js
  const previousLocation = useSelector(state => get('locationHistory.currentLocation', state))

  const confirm = useSelector(state => get('FullPageModal.confirm', state))

  const closeMenu = useCallback(() => {
    if (!confirm || window.confirm(t('You have unsaved changes, are you sure you want to leave?'))) {
      dispatch(setConfirmBeforeClose(false))
      navigate(previousLocation || groupUrl(groupSlug))
    }
  }, [confirm, previousLocation, groupSlug])

  const settingsMenuItems = useMemo(() => [
    canAdminister && { title: 'Group Details', url: 'settings' },
    canAdminister && { title: 'Agreements', url: 'settings/agreements' },
    canAdminister && { title: 'Welcome Page', url: 'settings/welcome' },
    canAdminister && { title: 'Responsibilities', url: 'settings/responsibilities' },
    canAdminister && { title: 'Roles & Badges', url: 'settings/roles' },
    canAdminister && { title: 'Privacy & Access', url: 'settings/privacy' },
    canAddMembers && { title: 'Invitations', url: 'settings/invite' },
    canAddMembers && { title: 'Join Requests', url: 'settings/requests' },
    canAdminister && { title: 'Related Groups', url: 'settings/relationships' },
    canManageTracks && { title: 'Tracks & Actions', url: 'settings/tracks' },
    canAdminister && { title: 'Custom Views', url: 'settings/views' },
    canAdminister && { title: 'Export Data', url: 'settings/export' },
    canAdminister && { title: 'Delete', url: 'settings/delete' }
  ].filter(Boolean), [canAdminister, canAddMembers, canManageTracks])

  return (
    <div className='ContextMenu-GroupSettings fixed h-full top-0 left-[88px] w-[300px] bg-background/60 z-10'>
      <div className='absolute h-full top-0 right-0 left-14 flex flex-col gap-2 bg-background shadow-[-15px_0px_25px_rgba(0,0,0,0.3)] px-2 z-10'>
        <h3 className='text-lg font-bold flex items-center gap-2 text-foreground'>
          <ChevronLeft className='w-6 h-6 inline cursor-pointer' onClick={closeMenu} />
          {t('Group Settings')}
        </h3>
        <ul className='flex flex-col gap-2 p-0'>
          {settingsMenuItems.map(item => (
            <li key={item.url}>
              <MenuLink
                to={groupUrl(groupSlug, item.url)}
                className={cn(
                  'text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100',
                  { 'text-secondary border-secondary': location.pathname === groupUrl(groupSlug, item.url) }
                )}
              >
                {t(item.title)}
              </MenuLink>
            </li>
          ))}
        </ul>
      </div>
      <div className='absolute top-0 left-0 z-0 w-full h-full' onClick={closeMenu} />
    </div>
  )
}
