import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { driver } from 'driver.js'
import { isSandboxMode } from 'sandbox/isSandbox'
import 'driver.js/dist/driver.css'
import './tours.css'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'
import TourInvitation from './TourInvitation'

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

// QA switch: visit any page with ?tourTest=true to make every tour act unseen
// on every load (and ?tourTest=false to turn it off again). While on, nothing
// is written to toursSeen or the offer counters, so real state is untouched.
function isTourTestMode () {
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

// Present in the DOM is not enough: on phones the nav rail and group menu are
// mounted but off-canvas, and highlighting an off-screen anchor floats the
// popover over whatever is actually visible
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

function isAnchorVisible (element) {
  if (!element) return false
  if (typeof element.checkVisibility === 'function' &&
      !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return false
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
  // An unmeasurable viewport (headless embeds) can't prove off-screen-ness;
  // fall back to the style and size checks above
  if (viewportWidth === 0 || viewportHeight === 0) return true
  return rect.right > 0 && rect.bottom > 0 &&
    rect.left < viewportWidth && rect.top < viewportHeight
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
  blockedBySelectors = []
}) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const currentUser = useSelector(getMe)
  const driverRef = useRef(null)
  const sandboxOverlayResizeRef = useRef(null)
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

  const markSeen = useCallback(() => {
    if (isTourTestMode()) return
    const seenNow = toursSeenRef.current
    if (!seenNow.includes(id)) {
      dispatch(updateUserSettings({ settings: { toursSeen: [...seenNow, id] } }))
    }
  }, [dispatch, id])

  const clearSandboxOverlayResize = useCallback(() => {
    if (!sandboxOverlayResizeRef.current) return
    window.removeEventListener('resize', sandboxOverlayResizeRef.current)
    sandboxOverlayResizeRef.current = null
  }, [])

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }
    clearSandboxOverlayResize()
    const presentSteps = steps.filter(step => !step.element || isAnchorVisible(document.querySelector(step.element)))
    if (presentSteps.length === 0) return false
    const keepSandboxBannerClear = isSandboxMode()
    tourActive = true
    driverRef.current = driver({
      showProgress: presentSteps.length > 1,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      nextBtnText: t('Next'),
      prevBtnText: t('Previous'),
      doneBtnText: t('Done'),
      steps: presentSteps,
      onHighlighted: () => {
        if (keepSandboxBannerClear) applySandboxBannerOverlayCutout()
      },
      // Closing early counts as seen: a dismissed tour must never chase the user
      onDestroyed: () => {
        clearSandboxOverlayResize()
        driverRef.current = null
        tourActive = false
        markSeen()
      }
    })
    if (keepSandboxBannerClear) {
      const handleResize = () => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => applySandboxBannerOverlayCutout())
        })
      }
      sandboxOverlayResizeRef.current = handleResize
      window.addEventListener('resize', handleResize)
    }
    driverRef.current.drive()
    return true
  }, [clearSandboxOverlayResize, markSeen, steps, t])

  const [inviteOpen, setInviteOpen] = useState(false)

  // If the surface unmounts while its invitation is up, release the slot
  useEffect(() => {
    if (!inviteOpen) return
    return () => { inviteActive = false }
  }, [inviteOpen])

  const closeInvite = useCallback(() => {
    inviteActive = false
    setInviteOpen(false)
  }, [])

  const acceptInvite = useCallback(() => {
    closeInvite()
    startTour()
  }, [closeInvite, startTour])

  const declineInvite = useCallback(() => {
    closeInvite()
    markSeen()
  }, [closeInvite, markSeen])

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
    let poll
    let timer
    let cancelled = false
    const clearToStart = () =>
      !document.getElementById('hylo-boot-loader') &&
      !tourActive &&
      !inviteActive &&
      !blockedBySelectors.some(selector => document.querySelector(selector))
    const anchorsAvailable = () =>
      steps.some(step => !step.element || isAnchorVisible(document.querySelector(step.element)))
    // Both paths are no-ops while every anchor is off-screen (phone nav
    // closed), so keep retrying quietly until the surface is actually visible
    const attempt = () => {
      if (cancelled) return
      if (mode === 'invite') {
        if (clearToStart() && anchorsAvailable()) {
          inviteActive = true
          setInviteOpen(true)
        } else {
          timer = setTimeout(attempt, 1000)
        }
      } else if (!(clearToStart() && startTour())) {
        timer = setTimeout(attempt, 1000)
      }
    }
    poll = setInterval(() => {
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
  }, [autoStart, enabled, seen, !!currentUser, signupInProgress, startTour, autoStartDelay, mode, id, testMode])

  useEffect(() => {
    return () => {
      clearSandboxOverlayResize()
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [clearSandboxOverlayResize])

  const invitation = inviteOpen
    ? (
      <TourInvitation
        message={inviteMessage}
        onAccept={acceptInvite}
        onDecline={declineInvite}
        onTimeout={timeoutInvite}
      />
      )
    : null

  return { startTour, seen, invitation }
}
