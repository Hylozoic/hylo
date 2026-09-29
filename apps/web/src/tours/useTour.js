import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { driver } from 'driver.js'
import { AnalyticsEvents } from '@hylo/shared'
import { isSandboxMode } from 'sandbox/isSandbox'
import 'driver.js/dist/driver.css'
import './tours.css'
import getMe from 'store/selectors/getMe'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import updateUserSettings from 'store/actions/updateUserSettings'
import TourInvitation from './TourInvitation'
import { resolveTourSteps } from './layouts'

/**
 * Guided tours built on driver.js. Each tour is a short, contextual sequence of
 * highlights tied to `data-tour` anchors on the current surface.
 *
 * Completion (or dismissal) is remembered per-user in the `toursSeen` setting,
 * so a tour fires once per account, across devices.
 *
 * `steps` must be referentially stable (useMemo in the caller) — it feeds the
 * auto-start effect. Steps whose `element` is absent from the DOM at start time
 * are skipped, so one definition can serve layouts that hide some controls.
 */
// Only one tour may run at a time; auto-starts wait for the active one to end
let tourActive = false

// …and only one invitation on screen at a time
let inviteActive = false

// A timed-out (ignored) invitation may offer itself again on a later visit,
// but only so many times before staying quiet for good. Device-local on
// purpose: politeness bookkeeping, not user data.
const OFFER_LIMIT = 2
const offerKey = id => `hylo-tour-offers:${id}`

// Module-level so driveTour (used from Help menu replays too) can clear the
// sandbox banner cutout listener when a tour ends
let sandboxOverlayResizeHandler = null

// QA switch: visit any page with ?tourTest=true to make every tour act unseen
// on every load (and ?tourTest=false to turn it off again). While on, nothing
// is written to toursSeen or the offer counters, so real state is untouched.
export function isTourTestMode () {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tourTest') === 'true') {
      window.localStorage.setItem('hylo-tour-test', 'true')
    } else if (params.get('tourTest') === 'false') {
      window.localStorage.removeItem('hylo-tour-test')
    }
    const on = window.localStorage.getItem('hylo-tour-test') === 'true'
    if (on && !window.__hyloTourTestAnnounced) {
      window.__hyloTourTestAnnounced = true
      console.info('[Hylo tours] Test mode is ON — every tour offers itself on every load. Turn off with ?tourTest=false')
    }
    return on
  } catch (e) {
    return false
  }
}
function offerCount (id) {
  try { return Number(window.localStorage.getItem(offerKey(id))) || 0 } catch (e) { return 0 }
}
function bumpOfferCount (id) {
  try { window.localStorage.setItem(offerKey(id), String(offerCount(id) + 1)) } catch (e) {}
}

function clearSandboxOverlayResize () {
  if (!sandboxOverlayResizeHandler) return
  window.removeEventListener('resize', sandboxOverlayResizeHandler)
  sandboxOverlayResizeHandler = null
}

// driver.js dims the full viewport; punch a second hole for the sandbox banner
// so language and reset stay reachable for the whole tour
function applySandboxBannerOverlayCutout () {
  const path = document.querySelector('svg.driver-overlay path')
  const banner = document.querySelector('[data-testid="sandbox-banner"]')
  if (!path || !banner) return
  const { x, y, width, height } = banner.getBoundingClientRect()
  if (width < 1 || height < 1) return
  const d = path.getAttribute('d')
  if (!d) return
  const cutout = `M${x},${y} h${width} v${height} h-${width} z`
  path.setAttribute('d', `${d} ${cutout}`)
}

// Present in the DOM is not enough: on phones the nav rail and group menu are
// mounted but off-canvas, and highlighting an off-screen anchor floats the
// popover over whatever is actually visible
export function isAnchorVisible (element) {
  if (!element) return false
  if (typeof element.checkVisibility === 'function' &&
      !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
  // An unmeasurable viewport (headless embeds) can't prove off-screen-ness;
  // fall back to the style and size checks above
  if (viewportWidth === 0) return true
  // Only horizontal off-canvas disqualifies (the phone nav slides sideways).
  // Vertically out-of-view elements are usually just scrolled past — the tour
  // scrolls each step into view when it highlights it
  if (!(rect.right > 0 && rect.left < viewportWidth)) return false
  // On-canvas is still not enough: a mounted surface can sit entirely under
  // another one (the phone menu over the group's home view), and touring the
  // covered surface makes no sense. Probe the anchor's visible center — the
  // probe only proves anything while that point is inside the viewport, so
  // scrolled-past anchors stay eligible per the note above
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
  if (viewportHeight === 0) return true
  const cx = (Math.max(rect.left, 0) + Math.min(rect.right, viewportWidth)) / 2
  const cy = (Math.max(rect.top, 0) + Math.min(rect.bottom, viewportHeight)) / 2
  if (cy <= 0 || cy >= viewportHeight) return true
  const hit = document.elementFromPoint(cx, cy)
  if (!hit) return true
  return element.contains(hit) || hit.contains(element)
}

export const TOUR_OUTCOME_COMPLETED = 'completed'
export const TOUR_OUTCOME_DISMISSED = 'dismissed'

/**
 * The key a tour's outcome is stored under in the toursOutcome setting. The
 * server stores setting keys in snake_case, so the tour id's dashes become
 * underscores ('post-editor' is kept as post_editor).
 */
export function tourOutcomeKey (tourId) {
  return String(tourId).replace(/[^a-zA-Z0-9]+/g, '_')
}

/**
 * The navigation layout a tour runs in, reported with its analytics events:
 * 'top-bar' for the tabs navigation, otherwise 'sidebar'.
 */
export function tourLayout (settings) {
  return settings?.globalNavStyle === 'tabs' ? 'top-bar' : 'sidebar'
}

/**
 * Steps for the layout on screen (see tours/layouts.js) whose anchor is
 * visible; steps without an anchor always count.
 */
export function presentTourSteps (steps) {
  return resolveTourSteps(steps)
    .filter(step => !step.element || isAnchorVisible(document.querySelector(step.element)))
}

/**
 * Runs a tour's steps through the shared driver.js setup. Steps whose anchor
 * is absent or covered are dropped; with nothing left it returns null and
 * nothing happens. Callers own persistence via onDestroyed, which learns
 * whether the tour was finished (Done on the last step) and the step it
 * ended on.
 */
export function driveTour (steps, { onDestroyed } = {}) {
  clearSandboxOverlayResize()
  const presentSteps = presentTourSteps(steps)
  if (presentSteps.length === 0) return null
  const keepSandboxBannerClear = isSandboxMode()
  let completed = false
  let lastStepIndex = 0
  tourActive = true
  const instance = driver({
    showProgress: presentSteps.length > 1,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 10,
    smoothScroll: true,
    // Center each step's anchor — including inside nested scroll containers
    // like modals, where driver's own in-view check can be fooled
    onHighlightStarted: (element) => {
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }
    },
    steps: presentSteps,
    onHighlighted: (element, step, opts) => {
      if (typeof opts?.index === 'number') lastStepIndex = opts.index
      if (keepSandboxBannerClear) applySandboxBannerOverlayCutout()
    },
    // Done on the last step is the only way a tour counts as completed
    onDoneClick: (element, step, opts) => {
      completed = true
      opts.driver.destroy()
    },
    onDestroyed: () => {
      clearSandboxOverlayResize()
      tourActive = false
      if (onDestroyed) onDestroyed({ completed, stepIndex: lastStepIndex, stepCount: presentSteps.length })
    }
  })
  if (keepSandboxBannerClear) {
    const handleResize = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => applySandboxBannerOverlayCutout())
      })
    }
    sandboxOverlayResizeHandler = handleResize
    window.addEventListener('resize', handleResize)
  }
  instance.drive()
  return instance
}

export default function useTour ({
  id,
  steps,
  autoStart = false,
  autoStartDelay = 2000,
  // 'invite' (default) offers a floating invitation first; 'auto' drives the
  // tour directly and is reserved for the very first, blank-slate tour
  mode = 'invite',
  // Copy for the invitation, e.g. "Your group is ready — want a quick tour?"
  inviteMessage,
  // Extra gate the caller computes (right context, data loaded, …)
  enabled = true,
  // Selectors that block auto-start while present (e.g. an open welcome modal)
  blockedBySelectors = [],
  // Layout name reported with the tour's analytics; defaults to the nav style
  layout
}) {
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const driverRef = useRef(null)
  const toursSeen = useMemo(
    () => currentUser?.settings?.toursSeen || [],
    [currentUser?.settings?.toursSeen]
  )
  const testMode = isTourTestMode()
  const seen = !testMode && toursSeen.includes(id)
  const signupInProgress = currentUser?.settings?.signupInProgress

  // Live stores (chat sockets, typing events) recreate settings objects
  // constantly; reading through a ref keeps markSeen — and everything built on
  // it — referentially stable so the auto-start countdown isn't reset on every
  // store update and can actually elapse
  const toursSeenRef = useRef(toursSeen)
  useEffect(() => { toursSeenRef.current = toursSeen }, [toursSeen])

  // Analytics go through the usual consent check; the stored outcome below
  // is kept whatever the person chose about analytics
  const layoutRef = useRef()
  layoutRef.current = layout || tourLayout(currentUser?.settings)
  const trackTour = useCallback((eventName, { stepIndex = null, stepCount, via } = {}) => {
    dispatch(trackAnalyticsEvent(eventName, {
      tourId: id,
      stepIndex,
      layout: layoutRef.current,
      ...(stepCount != null ? { stepCount } : {}),
      ...(via ? { via } : {})
    }))
  }, [dispatch, id])

  // Seen (so it never offers itself again) and how it ended: completed or dismissed
  const markSeen = useCallback((outcome) => {
    if (isTourTestMode()) return
    const seenNow = toursSeenRef.current
    const settings = { toursOutcome: { [tourOutcomeKey(id)]: outcome } }
    if (!seenNow.includes(id)) settings.toursSeen = [...seenNow, id]
    dispatch(updateUserSettings({ settings }))
  }, [dispatch, id])

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }
    const instance = driveTour(steps, {
      // Closing early counts as seen: a dismissed tour must never chase the user
      onDestroyed: ({ completed, stepIndex, stepCount }) => {
        driverRef.current = null
        const outcome = completed ? TOUR_OUTCOME_COMPLETED : TOUR_OUTCOME_DISMISSED
        trackTour(completed ? AnalyticsEvents.TOUR_COMPLETED : AnalyticsEvents.TOUR_DISMISSED, { stepIndex, stepCount })
        markSeen(outcome)
      }
    })
    if (!instance) return false
    driverRef.current = instance
    return true
  }, [markSeen, steps, trackTour])

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteClosing, setInviteClosing] = useState(false)

  // Navigating away mid-invitation dismisses it gracefully (fade out downward)
  // without burning an offer — the surface changed, the user didn't decline
  const location = useLocation()
  const invitePathnameRef = useRef(location.pathname)
  useEffect(() => {
    if (location.pathname === invitePathnameRef.current) return
    invitePathnameRef.current = location.pathname
    if (inviteOpen) setInviteClosing(true)
  }, [location.pathname, inviteOpen])

  // If the surface unmounts while its invitation is up, release the slot
  useEffect(() => {
    if (!inviteOpen) return
    return () => { inviteActive = false }
  }, [inviteOpen])

  const closeInvite = useCallback(() => {
    inviteActive = false
    setInviteOpen(false)
    setInviteClosing(false)
  }, [])

  const acceptInvite = useCallback(() => {
    closeInvite()
    trackTour(AnalyticsEvents.TOUR_ACCEPTED, { stepIndex: 0 })
    startTour()
  }, [closeInvite, startTour, trackTour])

  const declineInvite = useCallback(() => {
    closeInvite()
    trackTour(AnalyticsEvents.TOUR_DISMISSED)
    markSeen(TOUR_OUTCOME_DISMISSED)
  }, [closeInvite, markSeen, trackTour])

  const timeoutInvite = useCallback(() => {
    closeInvite()
    if (!isTourTestMode()) bumpOfferCount(id)
  }, [closeInvite, id])

  useEffect(() => {
    if (!autoStart || !enabled || seen || !currentUser || signupInProgress) return
    // Automated browsers (Playwright/Selenium) skip auto-fire so the overlay
    // never intercepts unrelated tests; tour specs start tours explicitly
    if (typeof navigator !== 'undefined' && navigator.webdriver) return
    // Ignored (timed-out) invitations only re-offer so many times
    if (mode === 'invite' && !testMode && offerCount(id) >= OFFER_LIMIT) return
    // Hold the countdown until the app is actually visible and free: the boot
    // loading screen (index.html) removes itself once its fade finishes, another
    // tour may be mid-run, and callers can name overlays (welcome modal) that
    // must close first
    let timer
    let cancelled = false
    const clearToStart = () =>
      !document.getElementById('hylo-boot-loader') &&
      !tourActive &&
      !inviteActive &&
      !blockedBySelectors.some(selector => document.querySelector(selector))
    const anchorsAvailable = () => presentTourSteps(steps).length > 0
    // Both paths are no-ops while every anchor is off-screen (phone nav
    // closed), so keep retrying quietly until the surface is actually visible
    const attempt = () => {
      if (cancelled) return
      if (mode === 'invite') {
        if (clearToStart() && anchorsAvailable()) {
          inviteActive = true
          setInviteOpen(true)
          trackTour(AnalyticsEvents.TOUR_OFFERED, { via: 'invitation' })
        } else {
          timer = setTimeout(attempt, 1000)
        }
      } else if (clearToStart() && startTour()) {
        trackTour(AnalyticsEvents.TOUR_OFFERED, { stepIndex: 0, via: 'auto' })
      } else {
        timer = setTimeout(attempt, 1000)
      }
    }
    const poll = setInterval(() => {
      if (clearToStart()) {
        clearInterval(poll)
        timer = setTimeout(attempt, autoStartDelay)
      }
    }, 300)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearTimeout(timer)
    }
  }, [autoStart, enabled, seen, !!currentUser, signupInProgress, startTour, trackTour, autoStartDelay, mode, id, testMode])

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [])

  const invitation = inviteOpen
    ? (
      <TourInvitation
        message={inviteMessage}
        onAccept={acceptInvite}
        onDecline={declineInvite}
        onTimeout={timeoutInvite}
        closing={inviteClosing}
        onClosed={closeInvite}
      />
      )
    : null

  return { startTour, seen, invitation }
}
