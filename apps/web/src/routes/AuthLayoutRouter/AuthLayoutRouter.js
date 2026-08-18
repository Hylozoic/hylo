import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { matchPath, Route, Routes, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { IntercomProvider } from 'react-use-intercom'
import { Helmet } from 'react-helmet'
import { get, some } from 'lodash/fp'
import { cn } from 'util/index'
import {
  createPersistentSelectionTracker,
  shouldBailTextSelectionGesture
} from 'util/textSelectionTouch'
import mixpanel from 'mixpanel-browser'
import config, { isDev, isTest } from 'config/index'
import CookieConsentLinker from 'components/CookieConsentLinker'
import ContextMenu from './components/ContextMenu'
import CreateModal from 'components/CreateModal'
import GlobalNav from './components/GlobalNav'
import ContextMenuGrid from './components/ContextMenu/ContextMenuGrid'
import MoreSpacesPage from './components/ContextMenu/MoreSpacesPage'
import TopNav from './components/TopNav'
import NotFound from 'components/NotFound'
import SocketListener from 'components/SocketListener'
import SocketSubscriber from 'components/SocketSubscriber'
import { useLayoutFlags } from 'contexts/LayoutFlagsContext'
import ViewHeader from 'components/ViewHeader'
// useSwipeGesture replaced by interactive nav drawer gesture below
import usePullToRefresh from 'hooks/usePullToRefresh'
import useIsPhoneViewport from 'hooks/useIsPhoneViewport'
import getReturnToPath from 'store/selectors/getReturnToPath'
import checkForNewNotifications from 'store/actions/checkForNewNotifications'
import setReturnToPath from 'store/actions/setReturnToPath'
import fetchForCurrentUser from 'store/actions/fetchForCurrentUser'
import fetchForGroup from 'store/actions/fetchForGroup'
import fetchPost from 'store/actions/fetchPost'
import fetchGroupsMenuData from 'store/actions/fetchGroupsMenuData'
import fetchThreads from 'store/actions/fetchThreads'
import getMe from 'store/selectors/getMe'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getMyGroupMembership from 'store/selectors/getMyGroupMembership'
import { getSignupInProgress } from 'store/selectors/getSignupState'
import { getLastViewedGroupPath } from 'store/selectors/getLastViewedGroup'
import { isSpaceGroup } from 'store/selectors/getMyGroups'
import orm from 'store/models'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import {
  POST_DETAIL_MATCH, GROUP_DETAIL_MATCH, localSpaceSlug, postUrl, spaceUrl
} from '@hylo/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import {
  isCardMenuPreference,
  isOneColumnLayout as resolveIsOneColumnLayout
} from 'util/navigationLayout'
import AllTopics from 'routes/AllTopics'
import ChatRoom from 'routes/ChatRoom'
import CreateGroup from 'routes/CreateGroup'
import CreateGroupModal from 'routes/CreateGroup/CreateGroupModal'
import GroupAboutPage from 'routes/GroupAboutPage'
import GroupDetail from 'routes/GroupDetail'
import PaymentSuccess from 'routes/GroupDetail/PaymentSuccess'
import PaymentFailure from 'routes/GroupDetail/PaymentFailure'
import GroupSettings from 'routes/GroupSettings'
import MembershipRequestsTab from 'routes/GroupSettings/MembershipRequestsTab'
import GroupWelcomeModal from 'routes/GroupWelcomeModal'
import GroupWelcomePage from 'routes/GroupWelcomePage'
import GroupExplorer from 'routes/GroupExplorer'
import Drawer from './components/Drawer'
import JoinGroup from 'routes/JoinGroup'
import LandingPage from 'routes/LandingPage'
import BootstrapShell from 'components/Skeleton/BootstrapShell'
import RouteBootstrapSkeleton from 'components/Skeleton/RouteBootstrapSkeleton'
import MapExplorer from 'routes/MapExplorer'
import MemberProfile from 'routes/MemberProfile'
import Members from 'routes/Members'
import MessagesLayout from 'routes/Messages/MessagesLayout'
import ThreadList from 'routes/Messages/ThreadList'
import MyTracks from 'routes/MyTracks'
import MyTransactions from 'routes/MyTransactions'
import OfferingDetails from 'routes/OfferingDetails/OfferingDetails'
import PostDetail from 'routes/PostDetail'
import Search from 'routes/Search'
import ViewContent from 'routes/ViewContent'
import SpaceContent from 'routes/SpaceContent'
import Themes from 'routes/Themes'
import UserSettings from 'routes/UserSettings'
import WelcomeWizardRouter from 'routes/WelcomeWizardRouter'
import { RESP_ADD_MEMBERS, RESP_ADMINISTRATION, VIEW_DRAFTS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { isAtReturnToPath } from 'util/returnToPath'
import Management from 'routes/Management'
import { getLocaleFromLocalStorage } from 'util/locale'
import { isCompactLayoutDevice, isDrawerNavLayout, isPhoneDevice } from 'util/mobile'
import { isLegacyWebView } from 'util/webView'
import store from 'store'
import { setMembershipLastViewedAt, toggleNavMenu } from './AuthLayoutRouter.store'
import { Toaster } from 'components/ui/sonner'
import useNewAppVersion from 'hooks/useNewAppVersion'
import useMobileHardwareBack from 'hooks/useMobileHardwareBack'

import classes from './AuthLayoutRouter.module.scss'

/** Reads a membership's group id from redux-orm (FK may be a model or raw id). */
function groupIdFromMembership (membership) {
  const group = membership?.group
  if (group == null) return null
  if (typeof group === 'object' && group.id != null) return String(group.id)
  if (typeof group === 'string' || typeof group === 'number') return String(group)
  return null
}

/** Max memberships (including spaces) before menu preload is skipped. */
const MENU_PRELOAD_MAX_MEMBERSHIPS = 60

/**
 * Legacy `/stream` → `/all`, preserving any trailing path (e.g. `/create`, `/post/:id`).
 */
function RedirectStreamToAll ({ basePath }) {
  const { '*': rest } = useParams()
  return <Navigate to={`${basePath}/all${rest ? `/${rest}` : ''}`} replace />
}

export default function AuthLayoutRouter (props) {
  const resizeRef = useRef()
  const navigate = useNavigate()
  const { hideNavLayout } = useLayoutFlags()
  // Start false so a Me load with stackGroups=true still triggers a childGroups refetch
  const prevStackGroupsRef = useRef(false)
  // Tabs are forced off on phone-sized viewports — only ~2 group icons fit there
  // and the existing mobile drawer already handles narrow screens well.
  const isPhoneViewport = useIsPhoneViewport()
  const withoutNav = isLegacyWebView() || hideNavLayout
  const newVersionAvailable = useNewAppVersion()
  const newVersionToastShownRef = useRef(false)
  useMobileHardwareBack()

  // Setup `pathMatchParams` and `queryParams` (`matchPath` best only used in this section)
  const location = useLocation()
  const pathMatchParams = useMemo(() => {
    const matches = [
      { path: `${POST_DETAIL_MATCH}` },
      { path: 'groups/:joinGroupSlug/join/:accessCode', context: 'groups' },
      { path: 'groups/:groupSlug/spaces/:spaceSlug/*', context: 'groups' },
      { path: 'groups/:groupSlug/:view/*', context: 'groups' },
      { path: 'groups/:groupSlug/*', context: 'groups' },
      { path: 'all/:view/*', context: 'all' },
      { path: 'public/:view/*', context: 'public' },
      { path: 'all/*', context: 'all' },
      { path: 'public/*', context: 'public' },
      { path: 'all', context: 'all' },
      { path: 'public', context: 'public' },
      { path: 'welcome/*', context: 'welcome' },
      { path: 'my/*', context: 'my' },
      { path: 'my', context: 'my' }
    ]
    const match = matches.find(match => matchPath(match, location.pathname))
    const matchResult = match ? matchPath(match, location.pathname) : null
    if (matchResult) {
      matchResult.params.context = match.context // XXX: kinda hacky, there's probably a better way to track "context"
      return matchResult.params
    }
    return { context: 'all' }
  }, [location.pathname])

  const hasDetail = useMemo(() => {
    // TODO: fix this hacky way to determine whether to open up the detail pane
    const detailRegex = /\/(group|post)\/([a-zA-Z0-9-]+)/
    return detailRegex.test(location.pathname) && (location.pathname.includes('map/') || location.pathname.includes('groups/group'))
  }, [location.pathname])

  const paramPostId = useMemo(() => {
    const match = location.pathname.match(/\/post\/(\d+)/)
    return match ? match[1] : null
  }, [location.pathname])

  const currentGroupSlug = pathMatchParams?.groupSlug
  const isMapView = pathMatchParams?.view === 'map'
  const isWelcomeContext = pathMatchParams?.context === 'welcome'
  const isCreateGroupRoute = location.pathname.startsWith('/create-group')
  // Store
  const dispatch = useDispatch()
  const currentGroup = useSelector(state => getGroupForSlug(state, currentGroupSlug))
  const currentGroupMembership = useSelector(state => getMyGroupMembership(state, currentGroupSlug))

  // Space posts are pushed to the space's group socket room — subscribe while the parent is open
  // so ContextMenu can show real-time badges for spaces and nested space views.
  const spaceSocketGroupIds = useMemo(() => {
    const items = currentGroup?.groupViews?.items || []
    return items
      .filter(view => view.type === 'space' && view.linkedGroup?.id)
      .map(view => String(view.linkedGroup.id))
  }, [currentGroup?.groupViews?.items])
  const currentUser = useSelector(getMe)
  const globalNavStyle = currentUser?.settings?.globalNavStyle === 'tabs' ? 'tabs' : 'sidebar'
  const stackGroups = currentUser?.settings?.stackGroups === true
  const isTabNav = globalNavStyle === 'tabs' && !isPhoneViewport
  const userGroupNavStyle = currentUser?.settings?.groupNavStyle
  const isCardMenuUser = isCardMenuPreference(userGroupNavStyle)
  const isOneColumnGroup = useMemo(() => {
    if (pathMatchParams?.context !== 'groups') return false
    return resolveIsOneColumnLayout(userGroupNavStyle, currentGroup?.settings?.layout)
  }, [pathMatchParams?.context, currentGroup?.settings?.layout, userGroupNavStyle])
  // Card menu for My / All / Public when the user explicitly chose one-column.
  const isOneColumnContext = isCardMenuUser && ['my', 'all', 'public'].includes(pathMatchParams?.context)
  const isOneColumnNav = isOneColumnGroup || isOneColumnContext
  // For simple groups: menu levels (home, more-spaces, space menu) and settings show
  // the inline sidebar; everything else ("a view") takes the full viewport with no sidebar.
  const isSimpleGroupHomeOrSettings = useMemo(() => {
    if (!currentGroupSlug) return false
    const path = location.pathname.replace(/\/$/, '')
    const groupBase = `/groups/${currentGroupSlug}`
    if (path === groupBase || path.startsWith(`${groupBase}/settings`)) return true
    if (path === `${groupBase}/more-spaces`) return true
    // Space menu root: /groups/:slug/spaces/:spaceSlug (no further view path)
    const spaceMenuMatch = path.match(new RegExp(`^/groups/${currentGroupSlug}/spaces/[^/]+$`))
    return Boolean(spaceMenuMatch)
  }, [currentGroupSlug, location.pathname])
  const isContextMenuHome = useMemo(() => {
    const path = location.pathname.replace(/\/$/, '')
    return path === '/my' || path === '/all' || path === '/public'
  }, [location.pathname])
  const isOneColumnHome = (isOneColumnGroup && isSimpleGroupHomeOrSettings) || (isOneColumnContext && isContextMenuHome)
  // Phone settings use master-detail in the center column, so the sidebar
  // (GlobalNav + GroupSettingsMenu) is suppressed entirely.
  const isOnGroupSettings = useMemo(() => {
    if (!currentGroupSlug) return false
    return location.pathname.startsWith(`/groups/${currentGroupSlug}/settings`)
  }, [currentGroupSlug, location.pathname])
  // Parent stewards are not auto-added to spaces; they still need settings (join requests).
  const canAccessSpaceSettings = useSelector(state => {
    if (!isSpaceGroup(currentGroup) || !isOnGroupSettings) return false
    return hasResponsibilityForGroup(state, {
      responsibility: [RESP_ADD_MEMBERS, RESP_ADMINISTRATION],
      groupId: currentGroup?.id
    })
  })
  const isPhoneSettings = isPhoneViewport && isOnGroupSettings
  const isDrawerOpen = useSelector(state => get('AuthLayoutRouter.isDrawerOpen', state))
  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state)) // For mobile nav
  const lastViewedGroupPath = useSelector(getLastViewedGroupPath)
  const memberships = useSelector(getMyMemberships)
  const returnToPath = useSelector(getReturnToPath)
  const signupInProgress = useSelector(getSignupInProgress)

  // Stable key for preload effect deps — getMyMemberships returns a new array reference on
  // every ORM update, which would otherwise reset the 4.5s timer indefinitely.
  const membershipGroupIdsKey = useMemo(() => (
    memberships
      .map(groupIdFromMembership)
      .filter(Boolean)
      .filter((id, index, self) => self.indexOf(id) === index)
      .sort()
      .join(',')
  ), [memberships])

  const [currentUserLoading, setCurrentUserLoading] = useState(true)
  const [currentGroupLoading, setCurrentGroupLoading] = useState(false)

  // Refs for mobile nav drawer animation
  const navContainerRef = useRef(null)
  const backdropRef = useRef(null)
  const preloadedMenuGroupIdsKeyRef = useRef('')
  const isNavOpenRef = useRef(isNavOpen)
  const isDraggingNavRef = useRef(false)
  const compactLayout = isCompactLayoutDevice()
  const phoneLayout = isPhoneDevice()

  // Phones and tablets share compact layout styling (see typography.scss).
  useEffect(() => {
    document.documentElement.classList.toggle('compact-layout', compactLayout)
    return () => document.documentElement.classList.remove('compact-layout')
  }, [compactLayout])

  // Keep isNavOpen ref in sync for use in touch handlers
  useEffect(() => { isNavOpenRef.current = isNavOpen }, [isNavOpen])

  // Callback refs set the initial off-screen position the instant the elements
  // mount into the DOM (after the loading screen), preventing any flash.
  const setNavContainerRef = useCallback((node) => {
    navContainerRef.current = node
    if (node && isDrawerNavLayout(window.innerWidth)) {
      node.style.transform = isNavOpenRef.current ? 'translateX(0)' : 'translateX(-100%)'
    }
  }, [])
  const setBackdropRef = useCallback((node) => {
    backdropRef.current = node
    if (node && isDrawerNavLayout(window.innerWidth)) {
      node.style.opacity = isNavOpenRef.current ? '1' : '0'
      node.style.pointerEvents = isNavOpenRef.current ? 'auto' : 'none'
    }
  }, [])

  // Clear mobile nav inline styles when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (!isDrawerNavLayout(window.innerWidth)) {
        const navEl = navContainerRef.current
        const backdropEl = backdropRef.current
        if (navEl) { navEl.style.transform = ''; navEl.style.transition = '' }
        if (backdropEl) { backdropEl.style.opacity = '0'; backdropEl.style.pointerEvents = 'none' }
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Animate nav position when isNavOpen changes (from chevron press or menu link click)
  useEffect(() => {
    const navEl = navContainerRef.current
    const backdropEl = backdropRef.current
    if (!navEl || !backdropEl || !isDrawerNavLayout(window.innerWidth)) return
    if (isDraggingNavRef.current) return // Drag handler manages position during drag

    navEl.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)'
    backdropEl.style.transition = 'opacity 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)'

    if (isNavOpen) {
      navEl.style.transform = 'translateX(0)'
      backdropEl.style.opacity = '1'
      backdropEl.style.pointerEvents = 'auto'
    } else {
      navEl.style.transform = 'translateX(-100%)'
      backdropEl.style.opacity = '0'
      backdropEl.style.pointerEvents = 'none'
    }
  }, [isNavOpen])

  // Interactive drag gesture for mobile nav drawer
  // - Drag from left edge to open (with real-time visual feedback)
  // - Drag right-to-left to close when open (with real-time visual feedback)
  // Refs are read lazily inside handlers so listeners work even before the
  // nav container mounts (e.g. while the loading screen is still showing).
  useEffect(() => {
    if (withoutNav) return

    const VELOCITY_THRESHOLD = 0.3 // px/ms — fast flick overrides position
    const POSITION_THRESHOLD = 0.4 // 40% of nav width to snap open
    const NAV_OPEN_EDGE_WIDTH_PX = 70

    let touchStartX = null
    let touchStartY = null
    let touchStartTime = null
    let isOpenGesture = false // attempting to open (nav currently closed)
    let isCloseGesture = false // attempting to close (nav currently open)
    let isDragging = false
    let directionLocked = false
    let navWidth = 0
    let startTranslateX = 0

    const setNavPosition = (translateXPx) => {
      const navEl = navContainerRef.current
      const backdropEl = backdropRef.current
      if (!navEl || !backdropEl) return
      navWidth = navEl.offsetWidth
      const clampedX = Math.min(0, Math.max(-navWidth, translateXPx))
      navEl.style.transform = `translateX(${clampedX}px)`
      const progress = 1 - Math.abs(clampedX) / navWidth
      backdropEl.style.opacity = String(progress)
      backdropEl.style.pointerEvents = progress > 0.01 ? 'auto' : 'none'
    }

    const animateNavTo = (open) => {
      const navEl = navContainerRef.current
      const backdropEl = backdropRef.current
      if (!navEl || !backdropEl) return
      navEl.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)'
      backdropEl.style.transition = 'opacity 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)'
      navEl.style.transform = open ? 'translateX(0)' : 'translateX(-100%)'
      backdropEl.style.opacity = open ? '1' : '0'
      backdropEl.style.pointerEvents = open ? 'auto' : 'none'
    }

    let touchTarget = null
    let touchStartedWithTextSelected = false
    let touchActive = false

    const selectionTracker = createPersistentSelectionTracker({
      getActiveTouch: () => touchActive
    })

    const handleTouchStart = (e) => {
      if (!isDrawerNavLayout(window.innerWidth)) return
      if (document.querySelector('.PostDialog-Content')) return
      if (shouldBailTextSelectionGesture(e.target)) return
      if (selectionTracker.hasSelection) return
      const navEl = navContainerRef.current
      const backdropEl = backdropRef.current
      if (!navEl || !backdropEl) return

      const touch = e.touches[0]

      // Swipe-to-open only from the left edge so horizontal drags in content
      // (e.g. text selection handles) are not hijacked as nav gestures.
      if (!isNavOpenRef.current && touch.clientX > NAV_OPEN_EDGE_WIDTH_PX) return

      touchActive = true
      touchStartX = touch.clientX
      touchStartY = touch.clientY
      touchStartTime = Date.now()
      touchTarget = e.target
      navWidth = navEl.offsetWidth
      isDragging = false
      directionLocked = false

      // Use the persistent flag so handle-drag touches are detected even when
      // iOS has temporarily cleared window.getSelection() at touchstart.
      touchStartedWithTextSelected = selectionTracker.hasSelection

      // Determine gesture type based on current nav state
      isOpenGesture = !isNavOpenRef.current
      isCloseGesture = isNavOpenRef.current

      startTranslateX = isCloseGesture ? 0 : -navWidth
    }

    const handleTouchMove = (e) => {
      if (touchStartX === null) return
      if (document.querySelector('.PostDialog-Content')) {
        touchStartX = null
        touchActive = false
        return
      }
      if (
        shouldBailTextSelectionGesture(e.target) ||
        touchStartedWithTextSelected ||
        selectionTracker.hasSelection
      ) {
        touchStartX = null
        touchActive = false
        return
      }

      const navEl = navContainerRef.current
      const backdropEl = backdropRef.current
      if (!navEl || !backdropEl) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStartX
      const deltaY = touch.clientY - touchStartY

      // Lock direction after sufficient movement
      if (!directionLocked) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Vertical scroll — abort (transitions never removed, no cleanup needed)
          touchStartX = null
          return
        }
        directionLocked = true

        // Validate direction: only right swipe opens, only left swipe closes
        if (isOpenGesture && deltaX <= 0) { touchStartX = null; return }
        if (isCloseGesture && deltaX >= 0) { touchStartX = null; return }

        // If the touch was held still long enough to suggest a long-press (300ms
        // is below the ~500ms iOS text-selection threshold but above any fast
        // swipe), or text was selected before this touch began (persistentHasSelection
        // survives the period where iOS clears getSelection() during a handle drag),
        // don't hijack the gesture — let the user select/expand text instead.
        if (isOpenGesture) {
          const elapsed = Date.now() - touchStartTime
          if (elapsed >= 300 || touchStartedWithTextSelected) { touchStartX = null; return }
        }

        // If opening (right swipe), check if touch is inside a horizontally
        // scrolled container — let native scroll handle scrolling back first
        if (isOpenGesture && touchTarget) {
          let el = touchTarget
          while (el && el !== document.body) {
            if (el.scrollLeft > 0) {
              const overflowX = window.getComputedStyle(el).overflowX
              if (overflowX === 'auto' || overflowX === 'scroll') {
                touchStartX = null
                return
              }
            }
            el = el.parentElement
          }
        }
      }

      // Only remove transitions once we've confirmed a valid horizontal drag
      if (!isDragging) {
        navEl.style.transition = 'none'
        backdropEl.style.transition = 'none'
      }

      isDragging = true
      isDraggingNavRef.current = true
      e.preventDefault()

      setNavPosition(startTranslateX + deltaX)
    }

    const handleTouchEnd = (e) => {
      if (!isDragging || touchStartX === null) {
        touchStartX = null
        touchStartY = null
        touchActive = false
        selectionTracker.clearIfGone()
        return
      }

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartX
      const elapsed = Date.now() - touchStartTime
      const velocity = Math.abs(deltaX) / Math.max(elapsed, 1)

      const navEl = navContainerRef.current
      navWidth = navEl ? navEl.offsetWidth : navWidth
      const finalTranslateX = startTranslateX + deltaX
      const clampedX = Math.min(0, Math.max(-navWidth, finalTranslateX))
      const progress = 1 - Math.abs(clampedX) / navWidth

      // High velocity flick: use direction; otherwise use position
      const shouldOpen = velocity > VELOCITY_THRESHOLD
        ? deltaX > 0
        : progress > POSITION_THRESHOLD

      animateNavTo(shouldOpen)
      isDraggingNavRef.current = false

      // Only update Redux if state actually changes
      if (shouldOpen !== isNavOpenRef.current) {
        dispatch(toggleNavMenu(shouldOpen))
      }

      touchStartX = null
      touchStartY = null
      isDragging = false
      touchActive = false
      selectionTracker.clearIfGone()
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
      selectionTracker.destroy()
    }
  }, [withoutNav, dispatch])

  // Pull-to-refresh gesture for WebView (web-side implementation)
  // Requires user to pull down AND hold for a moment to prevent accidental triggers
  const { isPulling, isReadyToRefresh, isRefreshing } = usePullToRefresh(
    () => window.location.reload(),
    { threshold: 120, holdDuration: 400 } // Pull 120px and hold for 400ms
  )

  // Baseline/regression: in Chrome DevTools open Performance (user timings: hylo-auth-bootstrap,
  // hylo-fetch-for-group) and Network (GraphQL response sizes). Compare before/after deploy.
  useEffect(() => {
    (async function () {
      if (isDev) performance.mark('hylo-auth-bootstrap-start')
      let bootstrapOk = false
      try {
        // Parallelise the two independent bootstrap fetches.
        // If the initial URL contains a post ID, race fetchPost alongside them
        // so the post data is ready (or nearly ready) by the time the auth shell renders.
        const bootstrapFetches = [
          dispatch(fetchForCurrentUser()),
          ...(paramPostId ? [dispatch(fetchPost(paramPostId))] : [])
        ]
        await Promise.all(bootstrapFetches)
        bootstrapOk = true
        if (isDev) {
          performance.mark('hylo-auth-bootstrap-end')
          try {
            performance.measure('hylo-auth-bootstrap', 'hylo-auth-bootstrap-start', 'hylo-auth-bootstrap-end')
          } catch (e) {
            // duplicate measure names across hot reload / strict mode
          }
        }
      } catch (e) {
        const detail = e?.message || (Array.isArray(e) ? JSON.stringify(e) : String(e))
        console.error('[Hylo auth bootstrap] failed', detail, e)
      } finally {
        setCurrentUserLoading(false)
      }
      if (!bootstrapOk) return
      const runThreads = () => dispatch(fetchThreads())
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runThreads, { timeout: 4000 })
      } else {
        setTimeout(runThreads, 2500)
      }
    })()
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await dispatch(checkForNewNotifications())
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // If the user turns stack-groups on after a flat MeQuery load, refetch so childGroups are available.
  useEffect(() => {
    const wasStacked = prevStackGroupsRef.current
    prevStackGroupsRef.current = stackGroups
    if (stackGroups && !wasStacked) {
      dispatch(fetchForCurrentUser({ includeChildGroups: true }))
    }
  }, [dispatch, stackGroups])

  useEffect(() => {
    if (currentUser?.settings?.locale) {
      getLocaleFromLocalStorage(currentUser?.settings?.locale)
    }
    if (!config.mixpanel.token || !currentUser?.id) return
    mixpanel.identify(currentUser.id)
    mixpanel.people.set({
      $name: currentUser.name,
      $email: currentUser.email,
      $location: currentUser.location
    })
  }, [currentUser?.email, currentUser?.id, currentUser?.location, currentUser?.name, currentUser?.settings?.locale])

  useEffect(() => {
    if (!config.mixpanel.token) return
    // Add all current group membershps to mixpanel user
    mixpanel.set_group('groupId', memberships.map(m => m.group.id))

    if (currentGroup?.id) {
      // Setup group profile info
      mixpanel.get_group('groupId', currentGroup.id).set({
        $location: currentGroup.location,
        $name: currentGroup.name,
        type: currentGroup.type
      })
    }
  }, [currentGroup?.id, currentGroup?.location, currentGroup?.name, currentGroup?.type, memberships])

  // Keep group loading in sync with the URL before paint so we never mount ViewContent/chat,
  // then swap to RouteBootstrapSkeleton when fetchForGroup sets loading (reopen / SPA nav).
  useLayoutEffect(() => {
    if (!currentGroupSlug) {
      setCurrentGroupLoading(false)
      return
    }
    const g = getGroupForSlug(store.getState(), currentGroupSlug)
    if (g?.slug === currentGroupSlug) {
      setCurrentGroupLoading(false)
    } else {
      setCurrentGroupLoading(true)
    }
  }, [currentGroupSlug])

  useEffect(() => {
    if (!currentGroupSlug) return
    let cancelled = false
    const slug = currentGroupSlug
    ;(async function () {
      if (isDev) performance.mark('hylo-fetch-group-start')
      await dispatch(fetchForGroup(slug))
      if (cancelled) return
      setCurrentGroupLoading(false)
      if (isDev) {
        performance.mark('hylo-fetch-group-end')
        try {
          performance.measure('hylo-fetch-for-group', 'hylo-fetch-group-start', 'hylo-fetch-group-end')
        } catch (e) {}
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentGroupSlug, dispatch])

  // Redirect to stream if user is a member but doesn't have access (expired subscription)
  useEffect(() => {
    if (currentGroupSlug && currentGroupMembership && currentGroup?.paywall && currentGroup?.canAccess === false) {
      const currentPath = location.pathname
      const homePath = `/groups/${currentGroupSlug}${currentGroup?.homeRoute || '/all'}`
      const onOfferingPurchasePath = currentPath.startsWith(`/groups/${currentGroupSlug}/offerings/`)
      // Only redirect if not already on a view page; keep offering URLs so members can buy access
      if (!currentPath.includes(homePath) && !currentPath.includes('/all') && !currentPath.includes('/stream') && !onOfferingPurchasePath) {
        // Mobile web: LOCATION_CHANGE only closes the group drawer, not the sliding nav + backdrop.
        // Close the nav so the paywall / no-access stream view is visible after redirect.
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
          dispatch(toggleNavMenu(false))
        }
        navigate(homePath, { replace: true })
      }
    }
  }, [currentGroupSlug, currentGroupMembership, currentGroup?.paywall, currentGroup?.canAccess, location.pathname, navigate, dispatch])

  // Pre-load context menu data for all membership groups in paginated batches.
  // This ensures context menus render immediately when switching groups.
  // Batches are processed sequentially (10 groups at a time) with a delay
  // after initial page load to let critical requests complete first.
  // Disabled for users with more than MENU_PRELOAD_MAX_MEMBERSHIPS memberships
  // (includes space memberships) to avoid overwhelming the backend.
  useEffect(() => {
    if (currentUserLoading) return
    if (memberships.length === 0 || memberships.length > MENU_PRELOAD_MAX_MEMBERSHIPS) return
    if (!membershipGroupIdsKey) return
    if (membershipGroupIdsKey === preloadedMenuGroupIdsKeyRef.current) return

    const groupIds = membershipGroupIdsKey.split(',')
    const INITIAL_DELAY = 4500
    const BATCH_SIZE = 10

    const timeoutId = setTimeout(async () => {
      preloadedMenuGroupIdsKeyRef.current = membershipGroupIdsKey
      const batches = []
      for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
        batches.push(groupIds.slice(i, i + BATCH_SIZE))
      }

      for (const batch of batches) {
        await dispatch(fetchGroupsMenuData(batch))
      }
    }, INITIAL_DELAY)

    return () => clearTimeout(timeoutId)
  }, [currentUserLoading, membershipGroupIdsKey, memberships.length, dispatch])

  // Scroll to top of center column when context, groupSlug, or view changes (from `pathMatchParams`)
  useEffect(() => {
    const centerColumn = document.getElementById(CENTER_COLUMN_ID)
    if (centerColumn) centerColumn.scrollTop = 0
  }, [pathMatchParams?.context, pathMatchParams?.groupSlug, pathMatchParams?.view])

  // Show a toast notification once when a new app version is detected
  useEffect(() => {
    if (!newVersionAvailable || newVersionToastShownRef.current) return
    newVersionToastShownRef.current = true
    toast('A new version of Hylo is available', {
      duration: Infinity,
      action: {
        label: 'Refresh',
        onClick: () => window.location.reload()
      }
    })
  }, [newVersionAvailable])

  if (currentUserLoading) {
    return (
      <div data-testid='loading-screen' className={cn('flex flex-row items-stretch bg-midground h-full', { 'h-[100dvh]': compactLayout })}>
        <Helmet>
          <title>Hylo</title>
          <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
        </Helmet>
        <BootstrapShell withoutNav={withoutNav} className='flex-1 min-h-0' />
      </div>
    )
  }

  // Auth gating (RootRouter) is driven by the auth session, not currentUser data, so this layout
  // can be mounted while currentUser is momentarily absent (e.g. during logout teardown). Build
  // intercom props defensively so a null user never throws while the shell renders.
  const intercomProps = currentUser
    ? {
        hideDefaultLauncher: true,
        userHash: currentUser.intercomHash,
        email: currentUser.email,
        name: currentUser.name,
        userId: currentUser.id
      }
    : { hideDefaultLauncher: true }
  const showMenuBadge = some(m => m.newPostCount > 0, memberships)

  // Only redirect to returnToPath when outside the welcome wizard. Inside the wizard,
  // the PENDING optimistic update sets signupInProgress=false before the server confirms,
  // which would cause a premature redirect followed by a race with fetchForCurrentUser.
  // AddLocation.goToNextStep() handles the redirect after the server actually confirms.
  if (!signupInProgress && returnToPath && !isWelcomeContext) {
    if (isAtReturnToPath(location, returnToPath)) {
      dispatch(setReturnToPath())
    } else {
      return <Navigate to={returnToPath} replace />
    }
  }

  if (signupInProgress && !isWelcomeContext) {
    return <Navigate to='/welcome' replace />
  }

  if (!currentGroupMembership && hasDetail && paramPostId && currentGroupSlug) {
    /* There are times when users will be send to a path where they have access to the POST on that path but not to the GROUP on that path
      This redirect replaces the non-accessible groupSlug from the path with '/all', for a better UI experience
    */
    return <Navigate to={postUrl(paramPostId, { context: 'all', groupSlug: null })} />
  }

  // Looking at a group that doesn't exist or current user doesn't have access to it.
  // Skip this when the URL carries invite/join credentials: FetchForGroup has no accessCode,
  // so hidden groups look missing until GroupDetail runs GroupDetailsQuery with those params.
  const groupInviteBypass =
    !!getQuerystringParam('accessCode', location) || !!getQuerystringParam('token', location)
  if (currentGroupSlug && !currentGroup && !currentGroupLoading && !groupInviteBypass) {
    return <NotFound />
  }

  // Spaces opened as top-level `/groups/:spaceSlug` must nest under their parent.
  // Covers cold-load restore, bookmarks, and any other bare-space links.
  if (
    currentGroupSlug &&
    currentGroup &&
    isSpaceGroup(currentGroup) &&
    currentGroup.parentId &&
    !location.pathname.includes('/spaces/') &&
    !isOnGroupSettings
  ) {
    const parentMembership = memberships.find(m => String(m.group?.id) === String(currentGroup.parentId))
    const parentFromOrm = orm.session(store.getState().orm).Group.withId(currentGroup.parentId)
    const parentSlug = parentMembership?.group?.slug || parentFromOrm?.slug
    if (parentSlug) {
      const local = localSpaceSlug(parentSlug, currentGroup.slug)
      const prefix = `/groups/${currentGroupSlug}`
      const rest = location.pathname.startsWith(prefix)
        ? location.pathname.slice(prefix.length)
        : ''
      const nestedPath = spaceUrl(parentSlug, local, rest || currentGroup.homeRoute || '/all')
      return <Navigate to={`${nestedPath}${location.search}`} replace />
    }
  }

  /* First time viewing a group redirect to welcome page if it exists, otherwise home view */
  // XXX: this is a hack, figure out better way to do this
  if (currentUser && currentGroupMembership && !get('lastViewedAt', currentGroupMembership)) {
    const lastViewedAt = (new Date()).toISOString()
    dispatch(setMembershipLastViewedAt(currentGroup.id, currentUser.id, lastViewedAt))
    if (currentGroup?.settings?.showWelcomePage) {
      navigate(`/groups/${currentGroupSlug}/welcome`, { replace: true })
    } else {
      navigate(`/groups/${currentGroupSlug}${currentGroup?.homeRoute || '/all'}`, { replace: true })
    }
  }

  return (
    <IntercomProvider appId={isTest ? '' : config.intercom.appId} autoBoot autoBootProps={intercomProps}>
      {/* Pull-to-refresh indicator - shows during and after gesture */}
      {(isPulling || isRefreshing) && (
        <div className='fixed top-4 left-1/2 -translate-x-1/2 z-50'>
          <div className={`bg-background border rounded-full p-3 shadow-lg transition-all duration-200 ${isReadyToRefresh || isRefreshing ? 'border-primary scale-110' : 'border-border'}`}>
            {isRefreshing
              ? (
                <svg className='w-5 h-5 animate-spin text-primary' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
                  <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                  <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' />
                </svg>
                )
              : (
                <svg className={`w-5 h-5 transition-all duration-200 ${isReadyToRefresh ? 'text-primary' : 'text-muted-foreground'}`} xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth='2'>
                  {isReadyToRefresh
                    ? <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                    : <path strokeLinecap='round' strokeLinejoin='round' d='M19 14l-7 7m0 0l-7-7m7 7V3' />}
                </svg>
                )}
          </div>
        </div>
      )}
      <Helmet>
        <title>{currentGroup ? `${currentGroup.name} | ` : ''}Hylo</title>
        <meta name='description' content='Prosocial Coordination for a Thriving Planet' />
        {currentUser && (
          <script id='greencheck' type='application/json'>
            {`{ 'id': '${currentUser.id}', 'fullname': '${currentUser.name}', 'description': '${currentUser.tagline}', 'image': '${currentUser.avatarUrl}' }`}
          </script>
        )}
      </Helmet>

      <Routes>
        {/* Redirects for switching into global contexts, since these pages don't exist yet */}
        <Route path='public/members' element={<Navigate to='/public' replace />} />
        <Route path='public/settings' element={<Navigate to='/public' replace />} />
        <Route path='all/members' element={<Navigate to='/all' replace />} />
        <Route path='all/settings' element={<Navigate to='/all' replace />} />

        {/* Redirect manage notifications page to settings page when logged in */}
        <Route path='notifications' element={<Navigate to='/my/notifications' replace />} />

        {/* DEPRECATED: Now always show GroupWelcomeModal */}
        {/* {!isWebView() && ( */}
        <>
          <Route path='groups/:groupSlug/*' element={<GroupWelcomeModal />} />
        </>
        {/* )} */}
      </Routes>

      <div className={cn('flex items-stretch bg-midground h-full', isTabNav ? 'flex-col' : 'flex-row', { 'h-[100dvh]': compactLayout, [classes.mapView]: isMapView, [classes.detailOpen]: hasDetail })}>
        {/* Top tab nav bar (when tab mode is active) */}
        {isTabNav && !withoutNav && (
          <TopNav currentUser={currentUser} />
        )}

        {/* Simple groups skip the mobile drawer pattern: their home dashboard already
            functions as the menu, so the sidebar renders inline (like desktop) on phone too. */}
        <div ref={resizeRef} className={cn(classes.main, { [classes.mapView]: isMapView, [classes.withoutNav]: withoutNav || isTabNav, [classes.mainPad]: !withoutNav && !isTabNav && !isOneColumnNav })}>
          {/* Mobile nav backdrop overlay - not shown on create-group so back chevron gets first tap */}
          {/* TODO: this is a hack for the create group route, which we may make a modal handle a different better way  */}
          {!withoutNav && !isTabNav && !isCreateGroupRoute && !isOneColumnNav && (
            <div
              ref={setBackdropRef}
              className={cn('fixed inset-0 z-[100] bg-black/50', !phoneLayout && 'sm:hidden')}
              style={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => dispatch(toggleNavMenu(false))}
            />
          )}
          <div
            ref={isTabNav || isOneColumnNav ? undefined : setNavContainerRef}
            className={cn(
              'AuthLayoutRouterNavContainer flex flex-row h-full flex-shrink-0 overflow-hidden',
              (isTabNav || isOneColumnNav)
                ? 'relative z-50 h-full w-auto'
                : [
                    // Phones: fixed drawer, full-width, off-screen by default (JS manages transform)
                    'fixed left-0 top-0 z-[101] h-dvh w-full',
                    // Tablet and desktop: back in normal flow
                    !phoneLayout && 'sm:relative sm:z-50 sm:h-full sm:w-auto sm:max-w-420'
                  ],
              // Hide nav for full-page Create Group flow
              isCreateGroupRoute && (phoneLayout ? 'hidden' : 'hidden sm:relative'),
              // Card-menu views take the full viewport on phone; GlobalNav stays on desktop.
              isOneColumnNav && !isOneColumnHome && 'hidden sm:flex',
              // Phone settings use master-detail in the center column — hide the sidebar.
              isPhoneSettings && 'hidden'
            )}
          >
            {!withoutNav && !isTabNav && (
              <>
                <GlobalNav
                  group={currentGroup}
                  currentUser={currentUser}
                  routeParams={pathMatchParams}
                  showMenuBadge={showMenuBadge}
                />
                {isDrawerOpen && <Drawer className={cn(classes.drawer)} group={currentGroup} context={pathMatchParams?.context} />}
              </>
            )}

            {(!currentGroupSlug || (currentGroup && (currentGroupMembership || canAccessSpaceSettings))) &&
              <Routes>
                {/* Card menu: My/All/Public homes use ContextMenuGrid in the center — no sidebar menu. */}
                {!isCardMenuUser && <Route path='public/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />}
                {!isCardMenuUser && <Route path='my/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />}
                {!isCardMenuUser && <Route path='all/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />}
                <Route path='groups/:joinGroupSlug/join/:accessCode' element={null} />
                {/* Simple groups: ContextMenu only renders for /settings (the settings sidebar).
                    Group home shows just the GlobalNav + ContextMenuGrid — no sidebar context menu. */}
                {!isOneColumnGroup && <Route path='groups/:groupSlug/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />}
                {isOneColumnGroup && <Route path='groups/:groupSlug/settings/*' element={<ContextMenu context={pathMatchParams?.context} currentGroup={currentGroup} mapView={isMapView} />} />}
                {isPhoneDevice() && (
                  <>
                    <Route path='messages/:messageThreadId/*' element={<ThreadList />} />
                    <Route path='messages' element={<ThreadList />} />
                  </>
                )}
              </Routes>}
          </div> {/* END NavContainer */}

          <div className='AuthLayoutRouterCenterContainer flex flex-col h-full w-full relative flex-1 min-w-0' id='center-column-container'>
            <Routes>
              <Route path='groups/:groupSlug/topics/:topicName/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/topics/:topicName/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/chat/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/chat/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/chat/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/members/:personId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/settings/:tab/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/:view/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/custom/:customViewId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/custom/:customViewId/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/:view/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/:view/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              {/* Space create/edit modals — mirror group routes under /spaces/:spaceSlug */}
              <Route path='groups/:groupSlug/spaces/:spaceSlug/chat/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/chat/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/chat/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/members/:personId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/:view/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/custom/:customViewId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/custom/:customViewId/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/:view/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/:view/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/post/:postId/create/*' element={<CreateModal context='groups' />} />
              <Route path='groups/:groupSlug/spaces/:spaceSlug/post/:postId/edit/*' element={<CreateModal context='groups' editingPost />} />
              <Route path='public/topics/:topicName/create/*' element={<CreateModal context='public' />} />
              <Route path='public/topics/:topicName/post/:postId/create/*' element={<CreateModal context='public' />} />
              <Route path='public/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
              <Route path='all/topics/:topicName/create/*' element={<CreateModal context='all' />} />
              <Route path='all/topics/:topicName/post/:postId/create/*' element={<CreateModal context='all' />} />
              <Route path='all/topics/:topicName/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
              <Route path='all/:view/create/*' element={<CreateModal context='all' />} />
              <Route path='all/:view/post/:postId/create/*' element={<CreateModal context='all' />} />
              <Route path='all/:view/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
              <Route path='public/:view/create/*' element={<CreateModal context='public' />} />
              <Route path='public/:view/post/:postId/create/*' element={<CreateModal context='public' />} />
              <Route path='public/:view/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
              <Route path='my/:view/create/*' element={<CreateModal context='my' />} />
              <Route path='my/:view/post/:postId/create/*' element={<CreateModal context='my' />} />
              <Route path='my/:view/post/:postId/edit/*' element={<CreateModal context='my' editingPost />} />
              <Route path='public/create/*' element={<CreateModal context='public' />} />
              <Route path='public/post/:postId/create/*' element={<CreateModal context='public' />} />
              <Route path='public/post/:postId/edit/*' element={<CreateModal context='public' editingPost />} />
              <Route path='all/create/*' element={<CreateModal context='all' />} />
              <Route path='all/post/:postId/create/*' element={<CreateModal context='all' />} />
              <Route path='all/post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
              <Route path='post/:postId/create/*' element={<CreateModal context='all' />} />
              <Route path='post/:postId/edit/*' element={<CreateModal context='all' editingPost />} />
              <Route path='messages/:messageThreadId/create/*' element={<CreateModal context='messages' />} />
              <Route path='messages/create/*' element={<CreateModal context='messages' />} />
            </Routes>

            <div className={cn('AuthLayout_centerColumn bg-midground flex flex-col px-0 relative min-h-1 h-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-450', { 'z-[60]': withoutNav, 'sm:p-0': isMapView })} id={CENTER_COLUMN_ID}>
              <ViewHeader />
              {/* NOTE: It could be more clear to group the following switched routes by component  */}
              <Routes>
                {/* **** Member Routes **** */}
                <Route path='members/:personId/*' element={<MemberProfile />} />
                <Route path='all/members/:personId/*' element={<MemberProfile />} />
                {/* **** All and Public Routes **** */}
                <Route path='all/stream/*' element={<ViewContent context='all' />} />
                <Route path='public/stream/*' element={<ViewContent context='public' />} />
                <Route path='all/projects/*' element={<ViewContent context='all' view='projects' />} />
                <Route path='public/projects/*' element={<ViewContent context='public' view='projects' />} />
                <Route path='all/proposals/*' element={<ViewContent context='all' view='proposals' />} />
                <Route path='public/proposals/*' element={<ViewContent context='public' view='proposals' />} />
                <Route path='all/events/*' element={<ViewContent context='all' view='events' />} />
                <Route path='public/events/*' element={<ViewContent context='public' view='events' />} />
                <Route path='all/map/*' element={<MapExplorer context='all' />} />
                <Route path='public/map/*' element={<MapExplorer context='public' />} />
                <Route path='public/groups/*' element={<GroupExplorer />} />
                <Route path='all/topics/:topicName' element={<ViewContent context='all' />} />
                <Route path='public/topics/:topicName' element={<ViewContent context='public' />} />
                <Route path='all/topics' element={<AllTopics />} />
                {/* Must be before `public/*` — otherwise `/public/post/:id/edit` matches `public/*` and redirects away */}
                <Route path='public/post/:postId/edit/*' element={<ViewContent context='public' />} />
                <Route path='public/post/:postId/create/*' element={<ViewContent context='public' />} />
                <Route path='all' element={isCardMenuUser ? <ContextMenuGrid context='all' /> : <ViewContent context='my' />} />
                <Route path='all/*' element={<ViewContent context='my' />} />
                <Route path='public' element={isCardMenuUser ? <ContextMenuGrid context='public' /> : <Navigate to='/public/stream' replace />} />
                <Route path='public/*' element={<Navigate to='/public/stream' replace />} />
                {/* Must be before `groups/:groupSlug/*` so `/groups/:slug/offerings/:id` is not handled only by the group splat + inner Navigate-to-stream */}
                <Route path='groups/:groupSlug/offerings/:offeringId' element={<OfferingDetails />} />
                {/* **** Group Routes **** */}
                <Route path='create-group/*' element={<CreateGroup />} />
                <Route path='groups/:joinGroupSlug/join/:accessCode' element={<JoinGroup />} />
                <Route path='h/use-invitation' element={<JoinGroup />} />
                <Route
                  path='groups/:groupSlug/*'
                  element={
                    /* When viewing a group, check membership first before rendering any group routes.
                       Skip the loading gate for post-detail URLs so PostDetail can render immediately
                       (post may be pre-fetched during bootstrap). Otherwise show route-shaped skeletons
                       instead of a bare spinner. */
                    currentGroupLoading && !paramPostId
                      ? <RouteBootstrapSkeleton />
                      : currentGroupSlug && !currentGroupMembership && !canAccessSpaceSettings
                        ? <GroupDetail context='groups' group={currentGroup} />
                        : (
                          <Routes>
                            <Route path='spaces/:spaceSlug/*' element={<SpaceContent parentGroup={currentGroup} isOneColumnGroup={isOneColumnGroup} />} />
                            <Route path='about/*' element={<GroupAboutPage />} />
                            <Route path='welcome/*' element={<GroupWelcomePage />} />
                            <Route path='map/*' element={<MapExplorer context='groups' view='map' />} />
                            <Route path='all/*' element={<ViewContent context='groups' view='all' />} />
                            <Route path='stream/*' element={<RedirectStreamToAll basePath={`/groups/${currentGroupSlug}`} />} />
                            <Route path='discussions/*' element={<ViewContent context='groups' view='discussions' />} />
                            <Route path='events/*' element={<ViewContent context='groups' view='events' />} />
                            <Route path='resources/*' element={<ViewContent context='groups' view='resources' />} />
                            <Route path='projects/*' element={<ViewContent context='groups' view='projects' />} />
                            <Route path='proposals/*' element={<ViewContent context='groups' view='proposals' />} />
                            <Route path='requests-and-offers/*' element={<ViewContent context='groups' view='requests-and-offers' />} />
                            <Route path='explore/*' element={<LandingPage />} />
                            <Route path='custom/:customViewId/*' element={<ViewContent context='groups' view='custom' />} />
                            <Route path='collection/:customViewId/*' element={<ViewContent context='groups' view='collection' />} />
                            <Route path='groups/*' element={<Navigate to='about/related-groups' replace />} />
                            <Route path='members/create/*' element={<Members context='groups' />} />
                            <Route path='members/:personId/*' element={<MemberProfile context='groups' />} />
                            <Route path='members/*' element={<Members context='groups' />} />
                            <Route path='topics/:topicName/*' element={<ViewContent context='groups' />} />
                            <Route path='topics' element={<AllTopics context='groups' />} />
                            <Route path='chat/*' element={<ChatRoom context='groups' />} />
                            <Route path='payment/success' element={<PaymentSuccess />} />
                            <Route path='payment/cancel' element={<PaymentFailure />} />
                            <Route path='payment/failure' element={<PaymentFailure />} />
                            <Route path='settings/*' element={<GroupSettings context='groups' />} />
                            <Route path='requests' element={<MembershipRequestsTab />} />
                            <Route
                              path='more-spaces'
                              element={
                                isOneColumnGroup
                                  ? <ContextMenuGrid group={currentGroup} />
                                  : <MoreSpacesPage group={currentGroup} />
                              }
                            />
                            {!isOneColumnGroup && <Route path={POST_DETAIL_MATCH} element={<PostDetail />} />}
                            <Route path='moderation/*' element={<Navigate to='about/moderation' replace />} />
                            <Route path='*' element={isOneColumnGroup ? <ContextMenuGrid group={currentGroup} /> : <Navigate to={`/groups/${currentGroupSlug}${currentGroup?.homeRoute || '/all'}`} replace />} />
                          </Routes>
                          )
                    }
                />
                {/* **** My Routes **** */}
                <Route path='my/posts/*' element={<ViewContent context='my' view='posts' />} />
                {/* My Drafts is a local-only stream; map it explicitly so `/my/drafts` bypasses settings. */}
                <Route path='my/drafts/*' element={<ViewContent context='my' view={VIEW_DRAFTS} />} />
                <Route path='my/interactions/*' element={<ViewContent context='my' view='interactions' />} />
                <Route path='my/announcements/*' element={<ViewContent context='my' view='announcements' />} />
                <Route path='my/mentions/*' element={<ViewContent context='my' view='mentions' />} />
                <Route path='my/saved-posts/*' element={<ViewContent context='my' view='saved-posts' />} />
                <Route path='my/tracks/*' element={<MyTracks />} />
                <Route path='my/transactions' element={<MyTransactions />} />
                <Route path='my/*' element={<UserSettings />} />
                <Route path='my' element={isCardMenuUser ? <ContextMenuGrid context='my' /> : <Navigate to='/my/posts' replace />} />
                {/* **** Management Routes (Admin Only) **** */}
                <Route path='management/*' element={<Management />} />
                {/* **** Other Routes **** */}
                <Route path='welcome/*' element={<WelcomeWizardRouter />} />
                <Route path='messages/:messageThreadId/*' element={<MessagesLayout />} />
                <Route path='messages' element={<MessagesLayout />} />
                <Route path='post/:postId/*' element={<PostDetail />} />
                {/* Keep old settings paths for mobile */}
                <Route path='settings/*' element={<UserSettings />} />
                <Route path='search/*' element={<Search />} />
                <Route path='themes' element={<Themes />} />
                <Route path='notifications' /> {/* XXX: hack because if i dont have this the default route overrides the redirect to /my/notifications above */}
                {/* **** Default Route (404) **** */}
                <Route path='*' element={<Navigate to={lastViewedGroupPath} replace />} />
              </Routes>
            </div>

            <div className={cn('DetailColumn bg-midground shadow-lg', classes.detail, { [classes.hidden]: !hasDetail })} id={DETAIL_COLUMN_ID}>
              <Routes>
                {/* All context routes */}
                <Route path={`/all/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                <Route path={`/all/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='all' />} />
                <Route path={`/all/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='all' />} />

                {/* Public context routes */}
                <Route path={`/public/groups/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                <Route path={`/public/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='public' />} />
                <Route path={`/public/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} />
                <Route path={`/public/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='public' />} />

                {/* My context routes */}
                {/* <Route path={`/my/mentions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/interactions/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/posts/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} />
                <Route path={`/my/announcements/${POST_DETAIL_MATCH}`} element={<PostDetail context='my' />} /> */}

                {/* Groups context routes */}
                <Route path={`/groups/:groupSlug/map/${POST_DETAIL_MATCH}`} element={<PostDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/custom/:customViewId/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/groups/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/map/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />
                <Route path={`/groups/:groupSlug/${GROUP_DETAIL_MATCH}`} element={<GroupDetail context='groups' />} />

                {/* Other routes */}
                <Route path={`/members/:personId/${POST_DETAIL_MATCH}`} element={<PostDetail />} />
              </Routes>
            </div>
            <SocketListener location={location} groupSlug={currentGroupSlug} />
            <SocketSubscriber type='group' id={get('slug', currentGroup)} />
            {spaceSocketGroupIds.map(spaceGroupId => (
              <SocketSubscriber key={`space-socket-${spaceGroupId}`} type='group' id={spaceGroupId} />
            ))}
          </div>
        </div>
        <CookieConsentLinker />
      </div>
      <CreateGroupModal />
      <Toaster
        position={compactLayout ? 'top-center' : 'bottom-left'}
        style={compactLayout ? {} : { left: '80px' }}
      />
    </IntercomProvider>
  )
}
