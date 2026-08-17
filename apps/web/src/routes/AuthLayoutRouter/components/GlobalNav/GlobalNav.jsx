import { cn } from 'util/index'
import { get } from 'lodash/fp'
import { Globe, HelpCircle, Plus, PlusCircle, Bell, MessagesSquare, ChevronDown, Settings, LogOut, User, Edit, Users, Mail, Bell as BellIcon, Palette, Languages, UserX, Search, Shield, BookOpen, Download, Heart, Wrench } from 'lucide-react'
import React, { Suspense, useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useIntercom } from 'react-use-intercom'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { replace } from 'redux-first-history'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import BadgedIcon from 'components/BadgedIcon'
import GlobalNavItem from './GlobalNavItem'
import GlobalNavTooltipContainer from './GlobalNavTooltipContainer'
import { getMyGroupsWithChildren } from 'store/selectors/getMyGroups'
import { isCompactLayoutDevice, isMobileDevice, downloadApp } from 'util/mobile'
import isWebView, { sendMessageToWebView, getMobileAppVersion } from 'util/webView'
import { getCookieConsent } from 'util/cookieConsent'
import { useCookieConsent } from 'contexts/CookieConsentContext'
import ModalDialog from 'components/ModalDialog'
import { pinGroup, unpinGroup, updateGroupNavOrder } from 'store/actions/pinGroup'
import markGroupAsRead from 'store/actions/markGroupAsRead'
import logout from 'store/actions/logout'
import { newMessageUrl, personUrl } from '@hylo/navigation'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { createGroupModalUrl } from 'routes/CreateGroup/createGroupUrl'
import {
  WebViewMessageTypes,
  LOCALE_DE,
  LOCALE_EN_GB,
  LOCALE_EN_US,
  LOCALE_ES,
  LOCALE_FR,
  LOCALE_HI,
  LOCALE_PT
} from '@hylo/shared'
import useAppearance from 'hooks/useAppearance'
import { getLocaleFromLocalStorage, normalizeLocaleToFull } from 'util/locale'
import updateUserSettings from 'store/actions/updateUserSettings'
import { availableThemes, getAppearanceFromSettings } from 'util/appearance'
import {
  NAV_STYLE_GROUP_DEFAULT,
  NAV_STYLE_ONE_COLUMN,
  NAV_STYLE_TWO_COLUMN
} from 'util/navigationLayout'

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
        childGroups={group.childGroups}
        isPinned
      />
    </div>
  )
}

const NotificationsDropdown = React.lazy(() => import('./NotificationsDropdown'))

/**
 * The + menu (per the design): four actions with colored icon tiles instead of
 * a list of every post type. Controlled popover so choosing a row closes it.
 */
function GlobalCreateMenu () {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const go = (path) => () => {
    setOpen(false)
    dispatch(toggleNavMenu(false))
    navigate(path)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label={t('Create')} data-testid='global-nav-create'>
        <div className={cn('bg-[hsl(0_0%_17%)] text-white relative z-20 transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-8 rounded-lg drop-shadow-md scale-90 hover:scale-100 hover:drop-shadow-lg text-3xl border-foreground/0 hover:border-foreground/50')}>
          <PlusCircle className='w-7 h-7' />
        </div>
      </PopoverTrigger>
      <PopoverContent side='right' align='end' className='w-[210px] p-1.5 rounded-xl'>
        <CreateMenuRow
          onClick={go(createGroupModalUrl(location))}
          tileClass='bg-[hsl(200_55%_45%)]'
          icon={<Plus className='w-4 h-4' />}
          label={t('Create a group')}
        />
        <CreateMenuRow
          onClick={go(`${location.pathname}/create/post`)}
          tileClass='bg-[hsl(155_51%_34%)]'
          icon={<Edit className='w-4 h-4' />}
          label={t('Create a post')}
        />
        <CreateMenuRow
          onClick={go(newMessageUrl())}
          tileClass='bg-[hsl(280_40%_42%)]'
          icon={<Mail className='w-4 h-4' />}
          label={t('New DM')}
        />
        <CreateMenuRow
          onClick={go('/public/groups')}
          tileClass='bg-[hsl(0_0%_22%)]'
          icon={<Globe className='w-4 h-4' />}
          label={t('Explore Groups')}
        />
      </PopoverContent>
    </Popover>
  )
}

function CreateMenuRow ({ onClick, tileClass, icon, label }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-foreground/90 hover:text-foreground hover:bg-foreground/10 transition-colors text-left'
    >
      <span className={cn('w-7 h-7 rounded-lg grid place-items-center text-white shrink-0', tileClass)}>{icon}</span>
      {label}
    </button>
  )
}

// Settings Menu Component
function SettingsMenu ({ currentUser, triggerClassName, contentSide = 'right', contentAlign = 'start' }) {
  const compactLayout = isCompactLayoutDevice()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { colorScheme } = useAppearance()
  const { theme } = getAppearanceFromSettings(currentUser?.settings)
  const globalNavStyle = currentUser?.settings?.globalNavStyle === 'tabs' ? 'tabs' : 'sidebar'
  const stackGroups = currentUser?.settings?.stackGroups === true
  const currentLocale = normalizeLocaleToFull(
    currentUser?.settings?.locale || i18n.language || getLocaleFromLocalStorage()
  )

  // Hide the Sidebar/Tabs toggle on phone viewports — tabs are forced off there.
  const [isPhoneViewport, setIsPhoneViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const handler = (e) => setIsPhoneViewport(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleLogout = async () => {
    await dispatch(logout())
    if (window.HyloMobileV2) {
      sendMessageToWebView(WebViewMessageTypes.LOGOUT)
    } else {
      dispatch(replace('/login', null))
    }
  }

  const handleViewProfile = () => {
    navigate(personUrl(currentUser?.id))
  }

  const handleEditProfile = () => {
    navigate('/my/edit-profile')
  }

  const handleMyGroups = () => {
    navigate('/my/groups')
  }

  const handleMyInvitations = () => {
    navigate('/my/invitations')
  }

  const handleNotificationSettings = () => {
    navigate('/my/notifications')
  }

  const handleBlockedUsers = () => {
    navigate('/my/blocked-users')
  }

  const handleSavedSearches = () => {
    navigate('/my/saved-searches')
  }

  const handleAccountSettings = () => {
    navigate('/my/account')
  }

  const handleManagement = () => {
    navigate('/management')
  }

  const mobileAppVersionLabel = typeof window !== 'undefined' && window.HyloMobileV2
    ? getMobileAppVersion()
    : ''

  const handleLanguageChange = (locale) => {
    const normalizedLocale = normalizeLocaleToFull(locale)
    i18n.changeLanguage(normalizedLocale)
    getLocaleFromLocalStorage(normalizedLocale)
    if (currentUser) {
      dispatch(updateUserSettings({ settings: { locale: normalizedLocale } }))
    }
  }

  const groupNavStyle = currentUser?.settings?.groupNavStyle || NAV_STYLE_GROUP_DEFAULT

  /**
   * Persists one or more appearance settings on the current user.
   */
  const handleSettingChange = (settings) => {
    if (currentUser) {
      dispatch(updateUserSettings({ settings }))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          data-testid='global-nav-settings-trigger'
          className={triggerClassName || cn('bg-primary relative transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 rounded-lg drop-shadow-md scale-90 hover:scale-100 hover:drop-shadow-lg text-3xl border-2 border-foreground/0 hover:border-foreground/50 cursor-pointer', compactLayout ? 'h-10' : 'h-10 sm:h-8')}
        >
          <Settings className={triggerClassName ? 'w-5 h-5' : cn(compactLayout ? 'w-7 h-7' : 'w-7 h-7 sm:w-6 sm:h-6')} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={contentSide}
        align={contentAlign}
        className={cn(
          'z-[200] bg-card',
          compactLayout
            ? 'min-w-[260px] [&_[role=menuitem]]:py-3 [&_[role=menuitem]]:text-base'
            : 'min-w-[260px] sm:min-w-[200px] [&_[role=menuitem]]:py-3 [&_[role=menuitem]]:text-base sm:[&_[role=menuitem]]:py-1.5 sm:[&_[role=menuitem]]:text-sm'
        )}
      >
        <DropdownMenuItem data-testid='global-nav-logout' onClick={handleLogout} className='flex flex-row items-center justify-between gap-2'>
          <span className='flex flex-row items-center min-w-0'>
            <LogOut className='mr-2 h-4 w-4 shrink-0' />
            <span className='truncate'>{t('Logout')} {currentUser?.email}</span>
          </span>
          {mobileAppVersionLabel
            ? <span className='text-xs text-muted-foreground shrink-0 tabular-nums'>v{mobileAppVersionLabel}</span>
            : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleViewProfile}>
          <User className='mr-2 h-4 w-4' />
          <span>{t('View Profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEditProfile}>
          <Edit className='mr-2 h-4 w-4' />
          <span>{t('Edit Profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMyGroups}>
          <Users className='mr-2 h-4 w-4' />
          <span>{t('My Groups')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMyInvitations}>
          <Mail className='mr-2 h-4 w-4' />
          <span>{t('My Invites')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNotificationSettings}>
          <BellIcon className='mr-2 h-4 w-4' />
          <span>{t('Notifications')}</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className='mr-2 h-4 w-4' />
            <span>{t('Appearance')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className='z-[200] bg-card'>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{t('Color Mode')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className='z-[200] bg-card'>
                <DropdownMenuRadioGroup value={colorScheme} onValueChange={value => handleSettingChange({ colorScheme: value })}>
                  <DropdownMenuRadioItem value='auto'>
                    {t('System')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value='light'>
                    {t('Light')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value='dark'>
                    {t('Dark')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{t('Color Theme')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className='z-[200] bg-card'>
                <DropdownMenuRadioGroup value={theme} onValueChange={value => handleSettingChange({ theme: value })}>
                  {availableThemes.map(theme => (
                    <DropdownMenuRadioItem key={theme} value={theme} className='capitalize'>
                      {t(theme)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {!isPhoneViewport && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span>{t('Global Navigation')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className='z-[200] bg-card'>
                  <DropdownMenuRadioGroup value={globalNavStyle} onValueChange={value => handleSettingChange({ globalNavStyle: value })}>
                    <DropdownMenuRadioItem value='sidebar'>
                      {t('Sidebar')}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value='tabs'>
                      {t('Topbar')}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{t('Group Nav Stacking')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className='z-[200] bg-card'>
                <DropdownMenuRadioGroup value={stackGroups ? 'stacked' : 'flat'} onValueChange={value => handleSettingChange({ stackGroups: value === 'stacked' })}>
                  <DropdownMenuRadioItem value='flat'>
                    {t('Flat')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value='stacked'>
                    {t('Stacked')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>{t('Group Menu Style')}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className='z-[200] bg-card'>
                <DropdownMenuRadioGroup value={groupNavStyle} onValueChange={value => handleSettingChange({ groupNavStyle: value })}>
                  <DropdownMenuRadioItem value={NAV_STYLE_GROUP_DEFAULT}>
                    {t('Group Default')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={NAV_STYLE_TWO_COLUMN}>
                    {t('Side Menu')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value={NAV_STYLE_ONE_COLUMN}>
                    {t('Card Menu')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className='mr-2 h-4 w-4' />
            <span>{t('Language')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className='z-[200] bg-card'>
            <DropdownMenuRadioGroup value={currentLocale} onValueChange={handleLanguageChange}>
              <DropdownMenuRadioItem value={LOCALE_EN_US}>
                🇺🇸 {t('English')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_EN_GB}>
                🇬🇧 {t('English (UK)')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_ES}>
                🇪🇸 {t('Spanish')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_DE}>
                🇩🇪 {t('German')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_FR}>
                🇫🇷 {t('French')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_HI}>
                🇮🇳 {t('Hindi')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={LOCALE_PT}>
                🇵🇹 {t('Portuguese')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={handleBlockedUsers}>
          <UserX className='mr-2 h-4 w-4' />
          <span>{t('Blocked Users')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSavedSearches}>
          <Search className='mr-2 h-4 w-4' />
          <span>{t('Saved Searches')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAccountSettings}>
          <Shield className='mr-2 h-4 w-4' />
          <span>{t('Account Settings')}</span>
        </DropdownMenuItem>
        {currentUser?.isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleManagement}>
              <Wrench className='mr-2 h-4 w-4' />
              <span>Management</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Settings and help sit on one row as small dark squares: they are utilities, not
// destinations, so they recede against the rail instead of reading as two more tiles.
const GLOBAL_NAV_UTILITY_BUTTON = 'relative flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-black/30 text-white/80 hover:text-white hover:bg-black/50 transition-all cursor-pointer'

export default function GlobalNav (props) {
  const { currentUser } = props
  const { show: showIntercom } = useIntercom()
  const { showPreferences } = useCookieConsent()
  const [showSupportModal, setShowSupportModal] = useState(false)
  const dispatch = useDispatch()
  const stackGroups = currentUser?.settings?.stackGroups === true
  const rawGroups = useSelector(getMyGroupsWithChildren)
  // When stacking is off, flatten: every group renders as its own item with no subgroup stack.
  const sortedGroups = useMemo(
    () => stackGroups ? rawGroups : rawGroups.map(group => ({ ...group, childGroups: [] })),
    [rawGroups, stackGroups]
  )
  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))
  const pinnedGroups = useMemo(() => sortedGroups.filter(group => group.navOrder != null), [sortedGroups])
  const unpinnedGroups = useMemo(() => sortedGroups.filter(group => group.navOrder == null), [sortedGroups])
  const compactLayout = isCompactLayoutDevice()
  // The store links only go anywhere on a phone or tablet, so don't offer the
  // download at all on desktop
  const showAppStoreLink = isMobileDevice() && !isWebView()
  const { t } = useTranslation()
  const [navReady, setNavReady] = useState(false)
  const [isContainerHovered, setIsContainerHovered] = useState(false)
  // A stack's subgroup menu and the rail's labels are alternatives, never both at
  // once: the submenu already names every group it contains, so labels behind it
  // are noise. Kept as a ref too for the listeners that outlive a render.
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const submenuOpenRef = useRef(false)
  // Labels give way to the submenu, but the scrim behind them stays: the submenu
  // reads as the rail continuing outward, so it needs the same ground to sit on.
  const showLabels = isContainerHovered && !submenuOpen
  const showScrim = isContainerHovered || submenuOpen
  const [menuTimeoutId, setMenuTimeoutId] = useState(null)
  const hoverDelayTimeoutRef = useRef(null)
  const ignoreTouchRef = useRef(false) // Ignore touch events briefly after nav opens
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [hiddenBadgeCount, setHiddenBadgeCount] = useState(0)
  const navContainerRef = useRef(null)
  const groupRefsMap = useRef(new Map())

  // Reveal all nav items in a single state flip after first paint.
  // Previously, items were revealed one-by-one via setInterval (50ms each),
  // causing N re-renders of GlobalNav for N groups. For users with many groups,
  // this blocked the main thread for 5-10 seconds, preventing all interaction.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setNavReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Suppress all hover/tooltip interactions briefly each time the nav becomes visible,
  // preventing phantom hover/tooltips from the tap that opened the nav.
  // useLayoutEffect ensures this runs synchronously after DOM mutation but
  // BEFORE the browser paints — so no events can slip through the gap.
  useLayoutEffect(() => {
    if (isNavOpen) {
      ignoreTouchRef.current = true
      window.dispatchEvent(new CustomEvent('navHoverSuppress', { detail: true }))
      const timeoutId = setTimeout(() => {
        ignoreTouchRef.current = false
        window.dispatchEvent(new CustomEvent('navHoverSuppress', { detail: false }))
      }, 400) // Long enough for the open animation + finger lift
      return () => clearTimeout(timeoutId)
    } else {
      // Clear immediately when nav closes (or on desktop where isNavOpen is always false)
      ignoreTouchRef.current = false
      window.dispatchEvent(new CustomEvent('navHoverSuppress', { detail: false }))
    }
  }, [isNavOpen])

  // Dismiss tooltips immediately when the adjacent ContextMenu scrolls
  useEffect(() => {
    const handleContextMenuScroll = () => {
      clearHover()
    }
    window.addEventListener('contextMenuScroll', handleContextMenuScroll)
    return () => window.removeEventListener('contextMenuScroll', handleContextMenuScroll)
  }, [])

  // A stack opening its submenu takes the rail's labels down with it
  useEffect(() => {
    const handleSubmenuToggle = (e) => {
      submenuOpenRef.current = e.detail
      setSubmenuOpen(e.detail)
      if (e.detail) clearHover()
    }
    window.addEventListener('navSubmenuToggle', handleSubmenuToggle)
    return () => window.removeEventListener('navSubmenuToggle', handleSubmenuToggle)
  }, [])

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

  // Detect if the nav container is overflowing (drives the top fade indicator).
  // The scrollbar itself is hidden via CSS, so no width compensation is needed
  // and the icon column stays symmetric inside its padding.
  useEffect(() => {
    const container = navContainerRef.current
    if (!container) return

    const checkOverflow = () => {
      setIsOverflowing(container.scrollHeight > container.clientHeight)
    }

    checkOverflow()
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(container)
    window.addEventListener('resize', checkOverflow)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', checkOverflow)
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
    // Fixed items (profile, notifications, messages, the commons) are always fully visible
    if (index <= 3) return 'opacity-100'
    // All other items revealed together after first paint (single re-render)
    return navReady ? '' : 'opacity-0'
  }

  const handleContainerPointerEnter = (e) => {
    // Ignore touch-originated pointer events — prevents phantom hover/tooltip
    // when the nav slides open and lands under the user's finger
    if (e.pointerType === 'touch' || ignoreTouchRef.current) return
    if (submenuOpenRef.current) return

    // Clear any existing timeout to avoid race conditions
    if (hoverDelayTimeoutRef.current) {
      clearTimeout(hoverDelayTimeoutRef.current)
    }
    // Delay showing hover state by 200ms on desktop to prevent accidental triggers
    hoverDelayTimeoutRef.current = setTimeout(() => {
      // Check current hover state directly from DOM instead of using the captured state variable
      const navContainer = document.querySelector('.globalNavContainer')
      if (navContainer && navContainer.matches(':hover')) {
        setIsContainerHovered(true)
      }
    }, 200)
  }

  const clearHover = () => {
    // Clear any pending hover delay timeout
    if (hoverDelayTimeoutRef.current) {
      clearTimeout(hoverDelayTimeoutRef.current)
      hoverDelayTimeoutRef.current = null
    }
    setIsContainerHovered(false)
  }

  const handleContainerPointerLeave = (e) => {
    if (e.pointerType === 'touch') return
    clearHover()
  }

  const handleClick = () => {
    clearHover()
  }

  // Touch events to handle hover state on mobile
  const clearHoverTimeoutRef = useRef(null)
  const isScrollingRef = useRef(false)
  const scrollEndTimeoutRef = useRef(null)
  const touchEndedRef = useRef(false)

  const startClearHoverCountdown = useCallback(() => {
    // Only start the countdown if the touch has already ended
    if (!touchEndedRef.current) return
    if (clearHoverTimeoutRef.current) clearTimeout(clearHoverTimeoutRef.current)
    clearHoverTimeoutRef.current = setTimeout(() => {
      clearHover()
      clearHoverTimeoutRef.current = null
    }, 3000) // 3 seconds to give users time to read and select
  }, [])

  const handleContainerTouchStart = () => {
    // Ignore touch events briefly after nav opens to prevent accidental triggers
    // when the nav slides in and a lingering touch event fires
    if (ignoreTouchRef.current) return
    // The submenu owns the screen while it's open
    if (submenuOpenRef.current) return

    // On touch, show immediately (no delay like desktop mouse hover)
    touchEndedRef.current = false
    setIsContainerHovered(true)
    if (clearHoverTimeoutRef.current) {
      clearTimeout(clearHoverTimeoutRef.current)
      clearHoverTimeoutRef.current = null
    }
  }

  const handleContainerTouchEnd = () => {
    touchEndedRef.current = true
    // If the container is currently momentum-scrolling, don't start the
    // countdown yet — the scroll handler will start it once scrolling stops.
    if (!isScrollingRef.current) {
      startClearHoverCountdown()
    }
  }

  // Keep the menu open while the nav container is momentum-scrolling.
  // After scrolling stops, restart the close countdown.
  useEffect(() => {
    const container = navContainerRef.current
    if (!container) return

    const handleNavScroll = () => {
      isScrollingRef.current = true
      // Scrolling the rail means the user has moved on from the stack they opened
      if (submenuOpenRef.current) {
        window.dispatchEvent(new CustomEvent('navSubmenuClose'))
      }
      // While scrolling, cancel any pending close timeout
      if (clearHoverTimeoutRef.current) {
        clearTimeout(clearHoverTimeoutRef.current)
        clearHoverTimeoutRef.current = null
      }
      // Reset the "scroll ended" debounce
      if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current)
      scrollEndTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
        // Scrolling has stopped — now start the close countdown if touch already ended
        startClearHoverCountdown()
      }, 150)
    }

    container.addEventListener('scroll', handleNavScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleNavScroll)
      if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current)
    }
  }, [startClearHoverCountdown])

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

  const handleMarkGroupAsRead = (groupId) => {
    dispatch(markGroupAsRead(groupId))
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
      className={cn('globalNavContainer flex flex-col bg-card relative h-full z-[50] items-center pb-0 pointer-events-auto user-select-none', { 'h-screen h-[100dvh]': compactLayout })}
      style={{
        boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.4)'
      }}
    >
      <div className='absolute inset-0 bg-gradient-to-b from-theme-background/75 to-theme-highlight dark:bg-gradient-to-b dark:from-theme-background/90 dark:to-theme-highlight/100 z-0' />
      <div className='absolute top-0 right-0 w-4 h-full bg-gradient-to-l from-theme-background/10 to-theme-background/0 z-20' />
      <div
        ref={navContainerRef}
        className={cn(
          // Scrollbar hidden (scrolling still works) so it never eats layout space
          // and the tiles stay horizontally centered in the rail
          'pt-4 flex flex-col items-center relative z-10 px-3 overflow-x-visible overflow-y-scroll grow',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          styles.globalNavContainer
        )}
        onClick={handleClick}
        onPointerLeave={handleContainerPointerLeave}
        onPointerEnter={handleContainerPointerEnter}
        onTouchStart={handleContainerTouchStart}
        onTouchEnd={handleContainerTouchEnd}
      >
        <GlobalNavItem
          img={get('avatarUrl', currentUser)}
          tooltip={t('My Home')}
          url='/my'
          className={isVisible(0)}
          showTooltip={showLabels}
        />

        <Suspense fallback={<GlobalNavItem className={isVisible(1)} showTooltip={showLabels}><Bell className='w-7 h-7' /></GlobalNavItem>}>
          <NotificationsDropdown renderToggleChildren={showBadge =>
            <GlobalNavItem
              darkTile
              tooltip={t('Activity')}
              className={isVisible(1)}
              showTooltip={showLabels}
              badgeCount={showBadge ? '-' : 0}
            >
              <BadgedIcon name='Notifications' className='!text-white cursor-pointer font-md' />
            </GlobalNavItem>}
          />
        </Suspense>

        <GlobalNavItem
          darkTile
          tooltip={t('Messages')}
          url='/messages'
          className={isVisible(2)}
          showTooltip={showLabels}
          badgeCount={currentUser?.unseenThreadCount || 0}
        >
          <MessagesSquare />
        </GlobalNavItem>

        <GlobalNavItem
          darkTile
          tooltip={t('The Commons')}
          url='/public'
          className={isVisible(3)}
          showTooltip={showLabels}
        >
          <Globe />
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
                    showTooltip={showLabels}
                    isContainerHovered={showLabels}
                    groupRefsMap={groupRefsMap}
                  />
                </RightClickMenuTrigger>
                <RightClickMenuContent>
                  <RightClickMenuItem onClick={() => handleMarkGroupAsRead(group.id)}>{t('Mark as Read')}</RightClickMenuItem>
                  <RightClickMenuItem onClick={() => handleUnpinGroup(group.id)}>{t('Unpin')}</RightClickMenuItem>
                </RightClickMenuContent>
              </RightClickMenu>
            ))}
          </SortableContext>
        </DndContext>

        {/* Add a divider between pinned and unpinned groups */}
        {pinnedGroups.length > 0 && <div className='rounded-lg bg-background/50 dark:bg-foreground/20 w-full mb-4 p-[2px]' />}

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
                    showTooltip={showLabels}
                    childGroups={group.childGroups}
                  />
                </RightClickMenuTrigger>
                <RightClickMenuContent>
                  <RightClickMenuItem onClick={() => handleMarkGroupAsRead(group.id)}>{t('Mark as Read')}</RightClickMenuItem>
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
            'opacity-80 translate-x-0': showScrim,
            'opacity-0 -translate-x-full': !showScrim
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

        <GlobalCreateMenu />

        {/* Settings and help are utilities rather than destinations, so they share a
            row as small dark squares instead of taking a full-width bright tile each */}
        <div className='flex items-center justify-center gap-1.5'>
          <SettingsMenu currentUser={currentUser} triggerClassName={GLOBAL_NAV_UTILITY_BUTTON} />

          <Popover>
            <PopoverTrigger>
              <span className={GLOBAL_NAV_UTILITY_BUTTON}>
                <HelpCircle className='w-5 h-5' />
              </span>
            </PopoverTrigger>
            <PopoverContent side='right' align='start'>
              <ul className='flex flex-col gap-2 m-0 p-0'>
                <li className='w-full'><span className='text-foreground cursor-pointer px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2' onClick={handleSupportClick}><MessagesSquare className='h-4 w-4' />{t('Feedback & Support')}</span></li>
                <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2' href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer'><BookOpen className='h-4 w-4' />{t('User Guide')}</a></li>
                <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2' href='http://hylo.com/terms/' target='_blank' rel='noreferrer'><Shield className='h-4 w-4' />{t('Terms & Privacy')}</a></li>
                {showAppStoreLink && <li className='w-full'><span className='text-foreground cursor-pointer px-2 py-1 hover:text-foreground/100 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2' onClick={downloadApp}><Download className='h-4 w-4' />{t('Download App')}</span></li>}
                <li className='w-full'><a className='text-foreground cursor-pointer px-2 py-1 hover:text-foreground/100 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2' href='https://opencollective.com/hylo' target='_blank' rel='noreferrer'><Heart className='h-4 w-4' />{t('Contribute to Hylo')}</a></li>
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
    </div>
  )
}

export { GlobalNavTooltipContainer, SettingsMenu }
