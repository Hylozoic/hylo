import { get } from 'lodash/fp'
import { ChevronLeft, GripHorizontal, Pencil, UserPlus, LogOut, Users } from 'lucide-react'
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useLocation, Routes, Route, useSearchParams } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { DndContext, DragOverlay, useDroppable, useDraggable, closestCorners } from '@dnd-kit/core'

import GroupMenuHeader from 'components/GroupMenuHeader'
import Icon from 'components/Icon'
import WidgetIconResolver from 'components/WidgetIconResolver'
import MenuLink from './MenuLink'
import useRouteParams from 'hooks/useRouteParams'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getContextWidgets } from 'store/selectors/contextWidgetSelectors'
import getMe from 'store/selectors/getMe'
import { removeWidgetFromMenu, updateContextWidget } from 'store/actions/contextWidgets'
import useGatherItems from 'hooks/useGatherItems'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import { setConfirmBeforeClose } from 'routes/FullPageModal/FullPageModal.store'
import { bgImageStyle, cn } from 'util/index'
import { widgetUrl, baseUrl, groupUrl, addQuerystringToPath, personUrl } from 'util/navigation'
import { ALL_GROUPS_CONTEXT_SLUG, MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/shared'
import ContextWidgetPresenter, {
  isValidChildWidget,
  getStaticMenuWidgets,
  orderContextWidgetsForContextMenu,
  isHiddenInContextMenuResolver,
  translateTitle
} from '@hylo/presenters/ContextWidgetPresenter'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import logout from 'store/actions/logout'
import classes from './ContextMenu.module.scss'

// Track all previous widgets and their children to detect new views
let previousWidgets = []
let previousChildItems = []

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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const group = useSelector(state => currentGroup || getGroupForSlug(state, routeParams.groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const rootPath = baseUrl({ ...routeParams, view: null })
  const isPublicContext = routeParams.context === PUBLIC_CONTEXT_SLUG
  const isMyContext = routeParams.context === MY_CONTEXT_SLUG
  const isAllContext = routeParams.context === ALL_GROUPS_CONTEXT_SLUG
  const profileUrl = personUrl(get('id', currentUser), routeParams.groupSlug)

  const rawContextWidgets = useSelector(state => {
    if (isMyContext || isPublicContext || isAllContext) {
      return getStaticMenuWidgets({ isPublicContext, isMyContext: isMyContext || isAllContext, profileUrl })
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

  const orderedWidgets = useMemo(() => orderContextWidgetsForContextMenu(contextWidgets), [contextWidgets])

  const isEditing = getQuerystringParam('cme', location) === 'yes' && canAdminister

  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))

  const [isDragging, setIsDragging] = useState(false)
  const [activeWidget, setActiveWidget] = useState(null)
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [])

  // Track the newly added top-level widget
  const newWidget = previousWidgets.length > 0 ? orderedWidgets.find(widget => previousWidgets.indexOf(widget.id) === -1) : null
  previousWidgets = orderedWidgets.map(widget => widget.id)
  const newWidgetRef = useRef()

  // Enhanced detection using multiple methods
  const [newViewId, setNewViewId] = useState(null)

  // Check URL param and localStorage for widget ID
  useEffect(() => {
    const newWidgetIdFromUrl = searchParams.get('newWidgetId')

    if (newWidgetIdFromUrl) {
      console.log('Found new widget ID in URL:', newWidgetIdFromUrl)
      setNewViewId(newWidgetIdFromUrl)

      // Remove from URL once detected
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('newWidgetId')
      navigate(`${location.pathname}?${newParams.toString()}`, { replace: true })
    } else {
      // Check localStorage as backup
      const storedWidgetId = localStorage.getItem('hylo:last-created-widget')
      const timestamp = parseInt(localStorage.getItem('hylo:last-created-timestamp') || '0')

      // Only use stored ID if it's recent (within last 5 seconds)
      if (storedWidgetId && Date.now() - timestamp < 5000) {
        console.log('Found new widget ID in localStorage:', storedWidgetId)
        setNewViewId(storedWidgetId)
        localStorage.removeItem('hylo:last-created-widget')
        localStorage.removeItem('hylo:last-created-timestamp')
      }
    }
  }, [searchParams, location, navigate])

  // Listen for custom events
  useEffect(() => {
    const handleNewWidgetEvent = (event) => {
      if (event.detail?.widgetId) {
        console.log('Received new widget event:', event.detail.widgetId)
        setNewViewId(event.detail.widgetId)
      }
    }

    window.addEventListener('hylo:new-widget-added', handleNewWidgetEvent)
    return () => {
      window.removeEventListener('hylo:new-widget-added', handleNewWidgetEvent)
    }
  }, [])

  // Gather all child items from all widgets to detect new views
  const allItems = useMemo(() => {
    let items = []
    // Collect items from child widgets
    contextWidgets.forEach(widget => {
      if (widget.childWidgets && widget.childWidgets.length > 0) {
        items = items.concat(widget.childWidgets.map(child => child.id))
      }
    })
    return items
  }, [contextWidgets])

  // Check for new views (including child views)
  useEffect(() => {
    if (previousChildItems.length > 0) {
      const newItem = allItems.find(id => previousChildItems.indexOf(id) === -1)
      if (newItem) {
        setNewViewId(newItem)
      }
    }
    previousChildItems = [...allItems]
  }, [allItems])

  /**
   * Effect to handle scrolling to and highlighting newly added widgets or views
   *
   * Waits for new elements to appear in the DOM, then scrolls precisely to their position
   * while applying visual animations (faster bounce + border flash) for feedback.
   */
  useEffect(() => {
    // Target element could be either a new top-level widget or a new child view
    const elementId = newWidget ? newWidget.id : newViewId
    if (!elementId) return

    // Initial delay to let React finish rendering
    const initialTimer = setTimeout(() => {
      // Function to find, reveal, and scroll to the target element
      const findAndScrollToElement = (retryCount = 0) => {
        // Try multiple selectors to find the element
        const targetElement = newWidget
          ? newWidgetRef.current
          : document.querySelector(`[data-view-id="${elementId}"]`) ||
            document.getElementById(`widget-${elementId}`) ||
            document.querySelector(`[data-widget-id="${elementId}"]`)

        if (!targetElement && retryCount < 5) {
          console.log('Element not found yet, retrying...', elementId)
          // Retry after a short delay if element not found
          setTimeout(() => findAndScrollToElement(retryCount + 1), 100 * (retryCount + 1))
          return
        }

        if (!targetElement) {
          console.log('Failed to find element after multiple attempts:', elementId)
          return
        }

        console.log('Found element for scrolling:', elementId)

        // First make the element visible
        targetElement.classList.remove('animate-slide-up')
        targetElement.classList.remove('invisible')

        // Short delay to let visibility change take effect
        setTimeout(() => {
          // Get the scrollable container
          const scrollContainer = document.querySelector('.ContextMenu')
          if (!scrollContainer) return

          // Calculate element's position relative to the scroll container
          const containerRect = scrollContainer.getBoundingClientRect()
          const elementRect = targetElement.getBoundingClientRect()

          // Determine if element is currently visible in the viewport
          const isFullyVisible =
            elementRect.top >= containerRect.top &&
            elementRect.bottom <= containerRect.bottom

          if (!isFullyVisible) {
            // Calculate the scroll position to center the element
            const scrollTop = scrollContainer.scrollTop
            const elementOffsetTop = elementRect.top - containerRect.top + scrollTop
            const centerPosition = elementOffsetTop - (containerRect.height / 2) + (elementRect.height / 2)

            console.log('Scrolling to position:', {
              element: elementId,
              elementOffsetTop,
              centerPosition,
              currentScroll: scrollTop
            })

            // Scroll to the calculated position
            scrollContainer.scrollTo({
              top: centerPosition,
              behavior: 'smooth'
            })
          } else {
            console.log('Element already visible, no scrolling needed')
          }
          // Find all links or buttons within the target element to apply border effects
          const targetLinks = targetElement.querySelectorAll('a, button, .border-2')

          // Apply bounce animation (faster, 1.2 seconds instead of 2.5)
          targetElement.classList.add('animate-bounce')
          // Apply border flash effect
          targetLinks.forEach(link => {
            // Store original border class for restoration
            const originalBorderClass = Array.from(link.classList)
              .find(cls => cls.includes('border-foreground'))

            // Add highlighted border
            if (originalBorderClass) {
              link.classList.remove(originalBorderClass)
            }
            link.classList.add('border-foreground/100')

            // Create pulsing effect with multiple flashes
            let flashCount = 0
            const maxFlashes = 3
            const flashInterval = setInterval(() => {
              flashCount++

              if (flashCount >= maxFlashes) {
                clearInterval(flashInterval)
                // Restore original border after flashing completes
                link.classList.remove('border-foreground/100')
                if (originalBorderClass) {
                  link.classList.add(originalBorderClass)
                } else {
                  link.classList.add('border-foreground/20')
                }
              } else {
                // Toggle border visibility for flash effect
                link.classList.toggle('border-foreground/100')
                link.classList.toggle('border-foreground/20')
              }
            }, 250) // Flash every 250ms
          })

          // Remove bounce animation after 1.2 seconds
          setTimeout(() => {
            targetElement.classList.remove('animate-bounce')
          }, 1200)

          // Clear the newViewId if applicable
          if (newViewId) {
            setNewViewId(null)
          }
        }, 50)
      }

      // Start the find-and-scroll process
      findAndScrollToElement()
    }, 100)

    return () => clearTimeout(initialTimer)
  }, [newWidget, newViewId])

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

  return (
    <div className={cn('ContextMenu bg-background z-20 overflow-y-auto h-lvh w-[300px] shadow-md', { [classes.mapView]: mapView }, { [classes.showGroupMenu]: isNavOpen }, className)}>
      <div className='ContextDetails w-full z-20 relative'>
        {routeParams.context === 'groups'
          ? <GroupMenuHeader group={group} />
          : isPublicContext
            ? (
              <div className='TheCommonsHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md'>
                <div className='absolute inset-0 bg-cover' style={{ ...bgImageStyle('/the-commons.jpg'), opacity: 0.5 }} />
                {/* <div style={bgImageStyle('/the-commons.jpg')} className='rounded-lg h-10 w-10 mr-2 shadow-md bg-cover bg-center' /> */}
                <div className='flex flex-col text-foreground drop-shadow-md overflow-hidden'>
                  <h2 className='text-foreground font-bold leading-3 text-lg drop-shadow-md'>{t('The Commons')}</h2>
                </div>
              </div>
              )
            : isMyContext
              ? (
                <div className='flex flex-col p-2'>
                  <h2 className='text-foreground font-bold leading-3 text-lg'>My Home</h2>
                </div>
                )
              : null}
      </div>
      {hasContextWidgets && (
        <div className='relative flex flex-col items-center overflow-hidden z-20'>
          <Routes>
            <Route path='settings/*' element={<GroupSettingsMenu group={group} />} />
          </Routes>

          <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
            <div className='w-full'>
              <ContextWidgetList
                isDragging={isDragging}
                isEditing={isEditing}
                contextWidgets={orderedWidgets}
                groupSlug={routeParams.groupSlug}
                rootPath={rootPath}
                canAdminister={canAdminister}
                activeWidget={activeWidget}
                newWidget={newWidget}
                newWidgetRef={newWidgetRef}
                group={group}
              />
            </div>
            <DragOverlay wrapperElement='ul'>
              {activeWidget && !activeWidget.parentId && (
                <ContextMenuItem widget={activeWidget} isOverlay group={group} groupSlug={routeParams.groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditing={isEditing} isDragging={isDragging} />
              )}
              {activeWidget && activeWidget.parentId && (
                <ListItemRenderer isOverlay item={activeWidget} group={group} rootPath={rootPath} groupSlug={routeParams.groupSlug} canDnd={false} />
              )}
            </DragOverlay>
          </DndContext>
          {(!isMyContext && !isPublicContext && !isAllContext) && (
            <div className='px-2 w-full mb-[0.05em] mt-6'>
              <ContextMenuItem
                widget={{ title: t('widget-all'), type: 'all-views', view: 'all-views', childWidgets: [] }}
                groupSlug={routeParams.groupSlug}
                rootPath={rootPath}
                canAdminister={canAdminister}
                allView
                isEditing={isEditing}
                group={group}
              />
            </div>)}
        </div>
      )}
      {isNavOpen && <div className={cn('ContextMenuCloseBg opacity-50 fixed right-0 top-0 w-full h-full z-10 transition-all duration-250 ease-in-out', { 'sm:block': isNavOpen })} onClick={toggleNavMenuAction} />}
    </div>
  )
}

function ContextWidgetList ({ contextWidgets, groupSlug, rootPath, canAdminister, isEditing, isDragging, activeWidget, newWidget, newWidgetRef, group }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handlePositionedAdd = ({ widget, addToEnd, parentId }) => {
    navigate(addQuerystringToPath(location.pathname, { addview: 'yes', cme: 'yes', parentId: widget?.parentId || parentId, orderInFrontOfWidgetId: widget?.id || null }))
  }

  const itemProps = {}
  if (newWidget) itemProps[newWidget.id] = { ref: newWidgetRef }

  return (
    <ul className='m-2 p-0 mb-6'>
      {isEditing &&
        <div>
          <DropZone removalDropZone isDragging={isDragging} droppableParams={{ id: 'remove' }}>
            Drag here to remove from menu
          </DropZone>
        </div>}
      {contextWidgets.map((widget, index) => (
        <li className='mb-2 items-start animate-slide-up invisible' style={{ '--delay': `${index * 35}ms` }} key={widget.id} {...itemProps[widget.id]}>
          <ContextMenuItem widget={widget} groupSlug={groupSlug} rootPath={rootPath} canAdminister={canAdminister} isEditing={isEditing} isDragging={isDragging} activeWidget={activeWidget} group={group} handlePositionedAdd={handlePositionedAdd} />
        </li>
      ))}
      {isEditing && (
        <button onClick={() => handlePositionedAdd({ id: 'bottom-of-list-' + groupSlug, addToEnd: true })} className='cursor-pointer text-sm text-foreground/40 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-background mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
          <Icon name='Plus' />Add new view
        </button>
      )}
    </ul>
  )
}

function ContextMenuItem ({ widget, groupSlug, rootPath, canAdminister = false, isEditing = false, allView = false, isDragging = false, isOverlay = false, activeWidget, group, handlePositionedAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
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
  const canDnd = !allView && isEditing && widget.type !== 'home'
  const showEdit = allView && canAdminister
  const hideDropZone = isOverlay || allView || !canDnd
  const isInvalidChild = !isValidChildWidget({ childWidget: activeWidget, parentWidget: widget })
  const hideBottomDropZone = ['setup'].includes(widget.type)

  if (isCreating) {
    return (
      <div className='border border-gray-700 rounded-md p-2 bg-white'>
        <h3 className='text-sm font-semibold'>{t('creatingWidget')}</h3>
      </div>
    )
  }

  // Check if the widget should be rendered
  if (isHiddenInContextMenuResolver(widget) && !isEditing) return null

  // Check admin visibility
  if (widget.visibility === 'admin' && !canAdminister) {
    return null
  }

  if (activeWidget && activeWidget.id === widget.id) {
    return null
  }

  if (widget.type === 'logout') {
    return (
      <div key={widget.id} className='ContextMenu ContextWidgetMenuItem mt-6'>
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
      <DropZone isDragging={isDragging} hide={hideDropZone} droppableParams={{ id: `${widget.id}`, data: { widget } }}>
        &nbsp;
      </DropZone>
      <div key={widget.id} ref={setDraggableNodeRef} style={style} data-view-id={widget.id}>
        {/* TODO CONTEXT: need to check this display logic for when someone wants a singular view (say, they pull projects out of the all view) */}
        {url && (widget.childWidgets.length === 0 && !['members', 'about'].includes(widget.type))
          ? (
            <>
              <MenuLink
                to={url}
                externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}
                className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full flex items-center justify-between transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'
              >
                <div>
                  <WidgetIconResolver widget={widget} />
                  <span className='text-base font-normal ml-2'>{title}</span>
                </div>
                {canDnd && isDroppable && <div className=''><GrabMe {...listeners} {...attributes} /></div>}
              </MenuLink>
            </>
            )
          : (
            <div>
              {widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <MenuLink
                    to={url}
                    externalLink={widget?.customView?.type === 'externalLink' ? widget.customView.externalLink : null}
                    badgeCount={widget.highlightNumber}
                  >
                    <h3 className='text-base font-light opacity-50 text-foreground'>{title}</h3>
                  </MenuLink>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {!widget.view &&
                <span className='flex justify-between items-center content-center'>
                  <h3 className='text-base font-light opacity-50 text-foreground'>{title}</h3>
                  {canDnd && isDroppable && <GrabMe {...listeners} {...attributes} />}
                </span>}
              {widget.type !== 'members' &&
                <div className={cn('flex flex-col relative transition-all text-foreground text-foreground hover:text-foreground',
                  {
                    'border-2 border-dashed border-foreground/20 rounded-md p-1 bg-background': isEditing && widget.type !== 'home'
                  })}
                >
                  <SpecialTopElementRenderer widget={widget} group={group} />
                  <ul className='p-0'>
                    {loading && <li key='loading'>Loading...</li>}
                    {presentedlistItems.length > 0 && presentedlistItems.map(item => <ListItemRenderer key={item.id} item={item} rootPath={rootPath} groupSlug={groupSlug} isDragging={isDragging} canDnd={canDnd} activeWidget={activeWidget} invalidChild={isInvalidChild} handlePositionedAdd={handlePositionedAdd} />)}
                    {widget.id && isEditing && !['home', 'setup'].includes(widget.type) &&
                      <li>
                        <DropZone isDragging={isDragging} hide={hideDropZone || hideBottomDropZone} isDroppable={canDnd && !url} droppableParams={{ id: 'bottom-of-child-list' + widget.id, data: { addToEnd: true, parentId: widget.id } }}>
                          &nbsp;
                        </DropZone>
                        <button onClick={() => handlePositionedAdd({ id: 'bottom-of-child-list' + widget.id, addToEnd: true, parentId: widget.id })} className={cn('cursor-pointer text-base text-foreground/40 border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100')}>
                          <Icon name='Plus' />
                          {widget.type === 'chats' ? <span>Add new chat </span> : <span>Add new view</span>}
                        </button>
                      </li>}
                  </ul>
                </div>}
              {widget.type === 'members' &&
                <div className='flex flex-col relative transition-all border-2 border-foreground/20 rounded-md bg-background text-foreground text-foreground hover:text-foreground'>
                  <SpecialTopElementRenderer widget={widget} group={group} />
                  <ul className='px-1 pt-1 pb-2'>
                    {loading && <li key='loading'>Loading...</li>}
                    {presentedlistItems.length > 0 && presentedlistItems.map(item => <ListItemRenderer key={item.id} item={item} rootPath={rootPath} groupSlug={groupSlug} isDragging={isDragging} canDnd={canDnd} activeWidget={activeWidget} invalidChild={isInvalidChild} handlePositionedAdd={handlePositionedAdd} />)}
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

function GrabMe ({ children, ...props }) {
  return (
    <span className='text-sm font-bold cursor-grab' {...props}>
      <GripHorizontal />
    </span>
  )
}

function DropZone ({ droppableParams, isDroppable = true, height = '', hide = false, children, removalDropZone, isDragging = false }) {
  const { setNodeRef, isOver } = useDroppable(droppableParams)

  if (hide || !isDroppable) {
    return null
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200 rounded-lg overflow-hidden',
        !isDragging && 'h-0',
        isDragging && !isOver && 'h-[8px] mb-1 bg-selected/10 hover:bg-foreground/20',
        isOver && !removalDropZone && 'bg-selected/70 p-5 min-h-[40px]',
        isOver && removalDropZone && 'bg-destructive/70 border-2 border-foreground p-5 min-h-[40px]',
        isDragging && !isOver && removalDropZone && 'bg-destructive/20 hover:bg-destructive/30'
      )}
    >
      {isOver && children}
    </div>
  )
}

function ListItemRenderer ({ item, rootPath, groupSlug, canDnd, isOverlay = false, activeWidget, invalidChild = false, handlePositionedAdd }) {
  const { t } = useTranslation()
  const itemTitle = translateTitle(item.title, t)
  const itemUrl = widgetUrl({ widget: item, rootPath, groupSlug })
  let hideDropZone = isOverlay

  const isItemDraggable = item.isDroppable && canDnd
  const { attributes: itemAttributes, listeners: itemListeners, setNodeRef: setItemDraggableNodeRef, transform: itemTransform } = useDraggable({ id: item.id })
  const itemStyle = itemTransform ? { transform: `translate3d(${itemTransform.x}px, ${itemTransform.y}px, 0)` } : undefined

  if (activeWidget && activeWidget.id === item.id) {
    hideDropZone = true
    return null
  }

  return (
    <React.Fragment key={item.id + itemTitle}>
      <DropZone hide={hideDropZone || invalidChild || !canDnd} droppableParams={{ id: `${item.id}`, data: { widget: item } }}>
        &nbsp;
      </DropZone>
      <li
        ref={setItemDraggableNodeRef}
        style={itemStyle}
        className='flex justify items-center content-center animate-slide-up invisible'
        data-view-id={item.id}
      >
        {(() => {
          if (item.type === 'chat') {
            return (
              <MenuLink
                badgeCount={item.highlightNumber}
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex items-center justify-between'
              >
                <div>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-2'>{itemTitle}</span>
                </div>
                {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
              </MenuLink>
            )
          } else if ((rootPath !== '/my' && rootPath !== '/all' && !item.title) || (item.type === 'viewUser')) {
            return (
              <MenuLink
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='transition-all px-2 py-1 pb-2 text-foreground scale-1 hover:scale-110 scale-100 hover:text-foreground opacity-80 hover:opacity-100 flex align-items justify-between'
              >
                <div>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-2'>{itemTitle}</span>
                </div>
                {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
              </MenuLink>
            )
          } else if (rootPath === '/my' || rootPath === '/all' || rootPath !== '/members' || (item.title && item.type !== 'chat')) {
            return (
              <MenuLink
                to={itemUrl}
                externalLink={item?.customView?.type === 'externalLink' ? item.customView.externalLink : null}
                className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100 flex align-items justify-between'
              >
                <div>
                  <WidgetIconResolver widget={item} />
                  <span className='text-base ml-2'>{itemTitle}</span>
                </div>
                {isItemDraggable && <GrabMe {...itemListeners} {...itemAttributes} />}
              </MenuLink>
            )
          }
        })()}
      </li>
    </React.Fragment>
  )
}

function SpecialTopElementRenderer ({ widget, group }) {
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADD_MEMBERS, groupId: group?.id }))
  const { t } = useTranslation()

  if (widget.type === 'members' && canAddMembers) {
    return (
      <div className='relative'>
        <div className='absolute -top-10 right-0  border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md bg-background text-foreground mb-[.5rem] transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
          <MenuLink
            to={groupUrl(group.slug, 'members')}
            className='flex items-center gap-2 px-2 py-1 text-foreground/50 hover:text-foreground/100 transition-all'
          >
            <Users className='w-4 h-4' />
            <span>{group.memberCount || 0}</span>
          </MenuLink>
        </div>
        <MenuLink to={groupUrl(group.slug, 'settings/invite')}>
          <div className='inline-block px-2 py-2 text-base font-medium text-foreground bg-foreground/20 rounded-sm mb-2 w-full rounded-bl-none rounded-br-none hover:bg-foreground/30 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer animate-slide-up invisible'>
            <UserPlus className='inline-block h-[20px] mr-1' /> {t('Add Members')}
          </div>
        </MenuLink>
      </div>
    )
  }

  if (widget.type === 'about') {
    return (
      <div className='w-full mb-8'>
        {group.purpose && <p className='px-3 text-xs text-foreground/50 hover:text-foreground/100 transition-all w-[255px] text-ellipsis overflow-hidden m-0 mb-2'>{group.purpose}</p>}
        {group.description && <p className='px-3 text-xs text-foreground/50 hover:text-foreground/100 transition-all w-[255px] text-ellipsis overflow-hidden m-0'>{group.description}</p>}
      </div>
    )
  }

  if (widget.type === 'setup') {
    const settingsUrl = groupUrl(group.slug, 'settings')

    const listItemComponent = ({ title, url }) => (
      <li className='w-full animate-slide-up invisible'>
        <MenuLink to={url} className='text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground mb-[.5rem] w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100'>
          {title}
        </MenuLink>
      </li>
    )

    return (
      <div className='mb-2'>
        <MenuLink to={groupUrl(group.slug, 'settings')}>
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

const SETTINGS_MENU_ITEMS = [
  { title: 'Group Details', url: 'settings' },
  { title: 'Agreements', url: 'settings/agreements' },
  { title: 'Welcome Page', url: 'settings/welcome' },
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
  const location = useLocation()
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
    <div className='fixed h-full top-0 left-[100px] w-[300px] bg-background/60 z-10'>
      <div className='absolute h-full top-0 right-0 left-14 flex flex-col gap-2 bg-background shadow-[-15px_0px_25px_rgba(0,0,0,0.3)] px-2 z-10'>
        <h3 className='text-lg font-bold flex items-center gap-2 text-foreground'>
          <ChevronLeft className='w-6 h-6 inline cursor-pointer' onClick={closeMenu} />
          {t('Group Settings')}
        </h3>
        <ul className='flex flex-col gap-2 p-0'>
          {SETTINGS_MENU_ITEMS.map(item => (
            <li key={item.url}>
              <MenuLink
                to={groupUrl(group.slug, item.url)}
                className={cn(
                  'text-base text-foreground border-2 border-foreground/20 hover:border-foreground/100 hover:text-foreground rounded-md p-2 bg-background text-foreground w-full block transition-all scale-100 hover:scale-105 opacity-85 hover:opacity-100',
                  { 'text-secondary border-secondary': location.pathname === groupUrl(group.slug, item.url) }
                )}
              >
                {item.title}
              </MenuLink>
            </li>
          ))}
        </ul>
      </div>
      <div className='absolute top-0 left-0 z-0 w-full h-full' onClick={closeMenu} />
    </div>
  )
}
