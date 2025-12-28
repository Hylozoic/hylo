import { cn } from 'util/index'
import { get } from 'lodash/fp'
import { Globe, HelpCircle, PlusCircle, Bell, MessagesSquare, ChevronDown } from 'lucide-react'
import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useIntercom } from 'react-use-intercom'
import { useSelector, useDispatch } from 'react-redux'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  RightClickMenu,
  RightClickMenuContent,
  RightClickMenuItem,
  RightClickMenuTrigger
} from 'components/ui/right-click-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import BadgedIcon from 'components/BadgedIcon'
import CreateMenu from 'components/CreateMenu'
import GlobalNavItem from './GlobalNavItem'
import GlobalNavTooltipContainer from './GlobalNavTooltipContainer'
import getMyGroups from 'store/selectors/getMyGroups'
import { isMobileDevice, downloadApp } from 'util/mobile'
import isWebView from 'util/webView'
import { getCookieConsent } from 'util/cookieConsent'
import { useCookieConsent } from 'contexts/CookieConsentContext'
import ModalDialog from 'components/ModalDialog'
import { pinGroup, unpinGroup, updateGroupNavOrder } from 'store/actions/pinGroup'

import styles from './GlobalNav.module.scss'

// Sortable wrapper for GlobalNavItem
function SortableGlobalNavItem ({ group, index, isVisible, showTooltip, isContainerHovered, groupRefsMap }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: group.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  // Combined ref handler for both sortable and tracking
  const handleRef = (node) => {
    setNodeRef(node)
    if (node && groupRefsMap) {
      groupRefsMap.current.set(group.id, node)
    }
  }

  return (
    <div
      ref={handleRef}
      style={{
        ...style,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        msUserSelect: 'none'
      }}
      {...attributes}
      {...listeners}
    >
      <GlobalNavItem
        badgeCount={group.newPostCount ? '-' : 0}
        img={group.avatarUrl}
        tooltip={group.name}
        url={`/groups/${group.slug}`}
        className={isVisible}
        showTooltip={isContainerHovered}
        isPinned
      />
    </div>
  )
}

const NotificationsDropdown = React.lazy(() => import('./NotificationsDropdown'))

export default function GlobalNav (props) {
  const { currentUser } = props
  const { show: showIntercom } = useIntercom()
  const { showPreferences } = useCookieConsent()
  const [showSupportModal, setShowSupportModal] = useState(false)
  const dispatch = useDispatch()
  const sortedGroups = useSelector(getMyGroups)
  const pinnedGroups = useMemo(() => sortedGroups.filter(group => group.navOrder !== null), [sortedGroups])
  const unpinnedGroups = useMemo(() => sortedGroups.filter(group => group.navOrder === null), [sortedGroups])
  const appStoreLinkClass = isMobileDevice() ? 'isMobileDevice' : 'isntMobileDevice'
  const { t } = useTranslation()
  const [visibleCount, setVisibleCount] = useState(0)
  const [isContainerHovered, setIsContainerHovered] = useState(false)
  const [showGradient, setShowGradient] = useState(false)
  const [menuTimeoutId, setMenuTimeoutId] = useState(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [scrollbarWidth, setScrollbarWidth] = useState(0)
  const [hiddenBadgeCount, setHiddenBadgeCount] = useState(0)
  const navContainerRef = useRef(null)
  const groupRefsMap = useRef(new Map())

  useEffect(() => {
    const totalItems = 4 + sortedGroups.length + 2 // fixed items + groups + plus & help buttons
    let currentCount = 0
    const interval = setInterval(() => {
      if (currentCount >= totalItems) {
        clearInterval(interval)
        return
      }
      currentCount++
      setVisibleCount(currentCount)
    }, 50) // 50ms between each item

    return () => clearInterval(interval)
  }, [sortedGroups.length])

  // Add effect to handle menu timeout
  useEffect(() => {
    if (isContainerHovered) {
      // Clear any existing timeout when hovering starts
      if (menuTimeoutId) {
        clearTimeout(menuTimeoutId)
        setMenuTimeoutId(null)
      }
      // Set a new timeout to check if still hovering after 10 seconds
      const timeoutId = setTimeout(() => {
        // Check if the menu container is actually being hovered
        const navContainer = document.querySelector(`.${styles.globalNavContainer}`)
        if (navContainer && !navContainer.matches(':hover')) {
          clearHover()
        }
      }, 10000) // 10 seconds
      setMenuTimeoutId(timeoutId)
    }
    return () => {
      if (menuTimeoutId) {
        clearTimeout(menuTimeoutId)
      }
    }
  }, [isContainerHovered])

  // Detect scrollbar width and if the nav container is overflowing
  useEffect(() => {
    const container = navContainerRef.current
    if (!container) return

    const checkOverflowAndScrollbar = () => {
      const hasOverflow = container.scrollHeight > container.clientHeight
      setIsOverflowing(hasOverflow)

      if (hasOverflow) {
        // Detect scrollbar width by comparing offsetWidth (includes scrollbar) with clientWidth (excludes scrollbar)
        // This tells us if the scrollbar is currently taking up layout space
        const width = container.offsetWidth - container.clientWidth

        // If width is 0, scrollbar is overlay-only (not taking space)
        // If width > 0, scrollbar is always visible (taking space) - we need to compensate
        setScrollbarWidth(width > 0 ? width : 0)
      } else {
        setScrollbarWidth(0)
      }
    }

    // Initial check
    checkOverflowAndScrollbar()

    // Use a small delay to ensure layout is complete
    const timeoutId = setTimeout(checkOverflowAndScrollbar, 100)

    const resizeObserver = new ResizeObserver(() => {
      // Small delay to ensure scrollbar state is updated
      setTimeout(checkOverflowAndScrollbar, 50)
    })
    resizeObserver.observe(container)

    // Also check on window resize to catch scrollbar visibility changes
    window.addEventListener('resize', checkOverflowAndScrollbar)

    return () => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkOverflowAndScrollbar)
    }
  }, [sortedGroups.length])

  // Add effect to handle scroll position updates for tooltips
  useEffect(() => {
    const handleScroll = () => {
      // Dispatch a custom event that child components can listen for
      const event = new CustomEvent('navScroll')
      window.dispatchEvent(event)
    }

    const container = navContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  // Track groups that have badges (new posts)
  const groupsWithBadges = useMemo(() => {
    return sortedGroups.filter(group => group.newPostCount > 0)
  }, [sortedGroups])

  // Calculate how many badged groups are hidden below the fold
  const calculateHiddenBadges = useCallback(() => {
    const container = navContainerRef.current
    if (!container) return

    let hiddenCount = 0
    const containerRect = container.getBoundingClientRect()
    const containerBottom = containerRect.bottom

    groupsWithBadges.forEach(group => {
      const element = groupRefsMap.current.get(group.id)
      if (element) {
        const elementRect = element.getBoundingClientRect()
        // If the element's top is below the container's visible bottom, it's hidden
        if (elementRect.top > containerBottom) {
          hiddenCount++
        }
      }
    })

    setHiddenBadgeCount(hiddenCount)
  }, [groupsWithBadges])

  // Update hidden badge count on scroll and resize
  useEffect(() => {
    const container = navContainerRef.current
    if (!container) return

    calculateHiddenBadges()

    const handleScrollOrResize = () => {
      calculateHiddenBadges()
    }

    container.addEventListener('scroll', handleScrollOrResize)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      container.removeEventListener('scroll', handleScrollOrResize)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [calculateHiddenBadges])

  // Scroll to next badged group that is below the fold
  const scrollToNextBadgedGroup = useCallback(() => {
    const container = navContainerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const containerBottom = containerRect.bottom

    // Find the first badged group that is below the visible area
    for (const group of groupsWithBadges) {
      const element = groupRefsMap.current.get(group.id)
      if (element) {
        const elementRect = element.getBoundingClientRect()
        if (elementRect.top > containerBottom - 50) {
          // Scroll this element into view with smooth animation
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
      }
    }

    // If no hidden badges found, scroll to the first one (cycle back)
    if (groupsWithBadges.length > 0) {
      const firstGroup = groupsWithBadges[0]
      const element = groupRefsMap.current.get(firstGroup.id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [groupsWithBadges])

  const isVisible = (index) => {
    // Special case for index 0-3 (profile, notifications, messages, the commons) - always visible with full opacity
    if (index === 0 || index === 1 || index === 2 || index === 3) return 'opacity-100'
    return index < visibleCount ? '' : 'opacity-0'
  }

  const handleContainerMouseEnter = () => {
    setIsContainerHovered(true)
    setTimeout(() => {
      // Check current hover state directly from DOM instead of using the captured state variable
      const navContainer = document.querySelector('.globalNavContainer')
      if (navContainer && navContainer.matches(':hover') && !isMobileDevice()) {
        setShowGradient(true)
      }
    }, 200)
  }

  const clearHover = () => {
    setIsContainerHovered(false)
    setShowGradient(false)
  }

  const handleContainerMouseLeave = () => {
    clearHover()
  }

  const handleClick = () => {
    clearHover()
  }

  // Touch events to handle hover state on mobile
  const [clearHoverTimeout, setClearHoverTimeout] = useState(null)
  const handleContainerTouchStart = () => {
    setIsContainerHovered(true)
    setShowGradient(true)
    if (clearHoverTimeout) {
      clearTimeout(clearHoverTimeout)
      setClearHoverTimeout(null)
    }
  }

  const handleContainerTouchEnd = () => {
    setClearHoverTimeout(setTimeout(() => {
      clearHover()
    }, 1000))
  }

  const handleSupportClick = () => {
    const consent = getCookieConsent()
    if (consent && consent.support === false) {
      setShowSupportModal(true)
    } else {
      showIntercom()
    }
  }

  const handlePinGroup = (groupId) => {
    dispatch(pinGroup(groupId))
  }

  const handleUnpinGroup = (groupId) => {
    dispatch(unpinGroup(groupId))
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Handle drag end for reordering pinned groups
  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active && over && active.id !== over.id) {
      const oldIndex = pinnedGroups.findIndex(group => group.id === active.id)
      const newIndex = pinnedGroups.findIndex(group => group.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Use arrayMove to calculate the new order
        const newOrder = arrayMove(pinnedGroups, oldIndex, newIndex)

        // Find the moved group in the new order and get its new position
        const movedGroup = newOrder.find(group => group.id === active.id)
        const newNavOrder = newOrder.indexOf(movedGroup)

        // Only update the moved group's navOrder - backend will handle updating others
        dispatch(updateGroupNavOrder(active.id, newNavOrder))
      }
    }
  }

  // Prevent default browser context menu on mobile devices
  const handleContextMenu = (e) => {
    if (isMobileDevice()) {
      e.preventDefault()
    }
  }

  // Allow scroll events to pass through to GlobalNav even when a modal post dialog is open
  useEffect(() => {
    const nav = document.querySelector('.globalNavContainer')
    nav.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: false })
  }, [])

  return (
    <div
      className={cn('globalNavContainer flex flex-col bg-gradient-to-b from-theme-background/75 to-theme-highlight dark:bg-gradient-to-b dark:from-theme-background/90 dark:to-theme-highlight/100 h-full z-[50] items-center pb-0 pointer-events-auto user-select-none', { 'h-screen h-[100dvh]': isMobileDevice() })}
      style={{
        boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.4)',
        webkitScrollbarColor: 'red'
      }}
      onClick={handleClick}
      onMouseLeave={handleContainerMouseLeave}
      onMouseEnter={handleContainerMouseEnter}
      onTouchStart={handleContainerTouchStart}
      onTouchEnd={handleContainerTouchEnd}
    >
      <div className='absolute top-0 right-0 w-4 h-full bg-gradient-to-l from-theme-background/10 to-theme-background/0 z-20' />
      <div
        ref={navContainerRef}
        className={cn(
          'pt-4 flex flex-col items-center relative z-10 px-3 overflow-x-visible overflow-y-scroll grow',
          styles.globalNavContainer
        )}
        style={{
          // When scrollbar is taking up space (always visible), add padding to compensate
          // This keeps content centered regardless of scrollbar visibility mode
          paddingRight: scrollbarWidth > 0 ? `calc(0.75rem - ${scrollbarWidth}px + 2px)` : undefined,
          paddingLeft: scrollbarWidth > 0 ? `calc(1.5rem - ${scrollbarWidth}px + 1px)` : undefined
        }}
        onMouseEnter={handleContainerMouseEnter}
      >
        <GlobalNavItem
          img={get('avatarUrl', currentUser)}
          tooltip={t('Your Profile')}
          url='/my'
          className={isVisible(0)}
          showTooltip={isContainerHovered}
        />

        <Suspense fallback={<GlobalNavItem className={isVisible(1)} showTooltip={isContainerHovered}><Bell className='w-7 h-7' /></GlobalNavItem>}>
          <NotificationsDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem
              tooltip={t('Activity')}
              className={isVisible(1)}
              showTooltip={isContainerHovered}
              badgeCount={showBadge ? '-' : 0}
            >
              <BadgedIcon name='Notifications' className='!text-primary-foreground cursor-pointer font-md' />
            </GlobalNavItem>}
          />
        </Suspense>

        <GlobalNavItem
          tooltip={t('Messages')}
          url='/messages'
          className={isVisible(2)}
          showTooltip={isContainerHovered}
          badgeCount={currentUser.unseenThreadCount || 0}
        >
          <MessagesSquare />
        </GlobalNavItem>

        <GlobalNavItem
          tooltip={t('The Commons')}
          url='/public'
          className={isVisible(3)}
          showTooltip={isContainerHovered}
        >
          <Globe color='hsl(var(--primary-foreground))' />
        </GlobalNavItem>

        {/* Pinned Groups Section - Sortable */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pinnedGroups.map(group => group.id)}
            strategy={verticalListSortingStrategy}
          >
            {pinnedGroups.map((group, pinnedIndex) => (
              <RightClickMenu key={group.id}>
                <RightClickMenuTrigger onContextMenu={handleContextMenu}>
                  <SortableGlobalNavItem
                    group={group}
                    index={pinnedIndex}
                    isVisible={isVisible(4 + pinnedIndex)}
                    showTooltip={isContainerHovered}
                    isContainerHovered={isContainerHovered}
                    groupRefsMap={groupRefsMap}
                  />
                </RightClickMenuTrigger>
                <RightClickMenuContent>
                  <RightClickMenuItem onClick={() => handleUnpinGroup(group.id)}>{t('Unpin')}</RightClickMenuItem>
                </RightClickMenuContent>
              </RightClickMenu>
            ))}
          </SortableContext>
        </DndContext>

        {/* Add a divider between pinned and unpinned groups */}
        {pinnedGroups.length > 0 && <div className='rounded-lg bg-foreground/20 w-full mb-4 p-[2px]' />}

        {/* Non-pinned Groups Section */}
        {unpinnedGroups.map((group, unpinnedIndex) => {
          const actualIndex = pinnedGroups.length + unpinnedIndex
          return (
            <div
              key={group.id}
              ref={(node) => {
                if (node) groupRefsMap.current.set(group.id, node)
              }}
            >
              <RightClickMenu>
                <RightClickMenuTrigger onContextMenu={handleContextMenu}>
                  <GlobalNavItem
                    badgeCount={group.newPostCount ? '-' : 0}
                    img={group.avatarUrl}
                    tooltip={group.name}
                    url={`/groups/${group.slug}`}
                    className={isVisible(4 + actualIndex)}
                    showTooltip={isContainerHovered}
                  />
                </RightClickMenuTrigger>
                <RightClickMenuContent>
                  <RightClickMenuItem onClick={() => handlePinGroup(group.id)}>{t('Pin to top')}</RightClickMenuItem>
                </RightClickMenuContent>
              </RightClickMenu>
            </div>
          )
        })}
      </div>

      <div
        className={cn(
          'fixed z-0 bottom-0 w-[400px] h-full',
          'transition-all duration-300 ease-out transform  backdrop-blur-md translate-x-0',
          {
            'opacity-80 translate-x-0': !showGradient,
            'opacity-0 -translate-x-full': !showGradient
          }
        )}
        style={{
          background: 'linear-gradient(to right, rgba(0,0,0,.7) 20%, rgba(0,0,0,0) 100%)',
          maxWidth: '600px',
          maskImage: 'linear-gradient(to right, rgba(0,0,0,1) calc(100% - 150px), rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) calc(100% - 130px), rgba(0,0,0,0) 100%)'
        }}
      />
      <div className='flex flex-col gap-2 justify-end w-full items-center z-50 pb-2 relative'>
        {isOverflowing && <div className='absolute -top-[10px] z-0 w-12 bg-gradient-to-t from-theme-background/60 dark:from-theme-background/90 to-theme-background/0 h-[20px] z-20 blur-sm '>&nbsp;</div>}

        {/* Hidden badges indicator - shows when there are badged groups below the fold */}
        {hiddenBadgeCount > 0 && (
          <div
            onClick={scrollToNextBadgedGroup}
            className={cn(
              'relative cursor-pointer transition-all ease-in-out duration-250',
              'flex flex-col items-center justify-center w-10 h-10',
              'rounded-full bg-accent drop-shadow-md',
              'scale-90 hover:scale-105 hover:drop-shadow-lg',
              'absolute -top-12'
            )}
            title={t('{{count}} groups with new posts below', { count: hiddenBadgeCount })}
          >
            <ChevronDown className='w-5 h-5 text-white' />
            <span className='absolute -top-1 -right-1 bg-white text-accent text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md'>
              {hiddenBadgeCount}
            </span>
          </div>
        )}

        <Popover>
          <PopoverTrigger>
            <div className={cn('bg-primary relative z-20 transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md scale-90 hover:scale-100 hover:drop-shadow-lg text-3xl border-foreground/0 hover:border-foreground/100')}>
              <PlusCircle className='w-7 h-7' />
            </div>
          </PopoverTrigger>
          <PopoverContent side='right' align='center'>
            <CreateMenu />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger>
            <span className={cn('bg-primary relative transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md scale-90 hover:scale-100 hover:drop-shadow-lg text-3xl border-2 border-foreground/0 hover:border-foreground/100')}>
              <HelpCircle className='w-7 h-7' />
            </span>
          </PopoverTrigger>
          <PopoverContent side='right' align='start'>
            <ul className='flex flex-col gap-2 m-0 p-0'>
              <li className='w-full'><span className='text-foreground cursor-pointer px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/100' onClick={handleSupportClick}>{t('Feedback & Support')}</span></li>
              <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/100' href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer'>{t('User Guide')}</a></li>
              <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/100' href='http://hylo.com/terms/' target='_blank' rel='noreferrer'>{t('Terms & Privacy')}</a></li>
              {!isWebView() && <li className='w-full'><span className={cn('text-foreground cursor-pointer px-2 py-1 hover:text-foreground/100 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/100', styles[appStoreLinkClass])} onClick={downloadApp}>{t('Download App')}</span></li>}
              <li className='w-full'><a className='text-foreground cursor-pointer px-2 py-1 hover:text-foreground/100 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/100' href='https://opencollective.com/hylo' target='_blank' rel='noreferrer'>{t('Contribute to Hylo')}</a></li>
            </ul>
            {showSupportModal && (
              <ModalDialog
                closeModal={() => setShowSupportModal(false)}
                showModalTitle={false}
                submitButtonAction={() => {
                  setShowSupportModal(false)
                  showPreferences()
                }}
                submitButtonText={t('Edit Cookie Preferences')}
              >
                <div className='p-4'>
                  <h2 className='text-xl font-semibold mb-2'>{t('Support Chat Disabled')}</h2>
                  <p className='text-foreground/70 mb-4'>
                    {t('To use the support chat you need to enable support cookies in your cookie preferences')}
                  </p>
                  <p className='text-foreground/70 mb-2'>
                    {t('Click below to edit your cookie preferences')}
                  </p>
                </div>
              </ModalDialog>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export { GlobalNavTooltipContainer }
