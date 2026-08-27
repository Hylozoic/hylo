import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './tours.css'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'

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

export default function useTour ({
  id,
  steps,
  autoStart = false,
  autoStartDelay = 2000,
  // Extra gate the caller computes (right context, data loaded, …)
  enabled = true,
  // Selectors that block auto-start while present (e.g. an open welcome modal)
  blockedBySelectors = []
}) {
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const driverRef = useRef(null)
  const toursSeen = useMemo(
    () => currentUser?.settings?.toursSeen || [],
    [currentUser?.settings?.toursSeen]
  )
  const seen = toursSeen.includes(id)
  const signupInProgress = currentUser?.settings?.signupInProgress

  const markSeen = useCallback(() => {
    if (!toursSeen.includes(id)) {
      dispatch(updateUserSettings({ settings: { toursSeen: [...toursSeen, id] } }))
    }
  }, [dispatch, id, toursSeen])

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }
    const presentSteps = steps.filter(step => !step.element || document.querySelector(step.element))
    if (presentSteps.length === 0) return
    tourActive = true
    driverRef.current = driver({
      showProgress: presentSteps.length > 1,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      steps: presentSteps,
      // Closing early counts as seen: a dismissed tour must never chase the user
      onDestroyed: () => {
        driverRef.current = null
        tourActive = false
        markSeen()
      }
    })
    driverRef.current.drive()
  }, [markSeen, steps])

  useEffect(() => {
    if (!autoStart || !enabled || seen || !currentUser || signupInProgress) return
    // Automated browsers (Playwright/Selenium) skip auto-fire so the overlay
    // never intercepts unrelated tests; tour specs start tours explicitly
    if (typeof navigator !== 'undefined' && navigator.webdriver) return
    // Hold the countdown until the app is actually visible and free: the boot
    // loading screen (index.html) removes itself once its fade finishes, another
    // tour may be mid-run, and callers can name overlays (welcome modal) that
    // must close first
    let timer
    const clearToStart = () =>
      !document.getElementById('hylo-boot-loader') &&
      !tourActive &&
      !blockedBySelectors.some(selector => document.querySelector(selector))
    const poll = setInterval(() => {
      if (clearToStart()) {
        clearInterval(poll)
        timer = setTimeout(() => {
          if (clearToStart()) startTour()
        }, autoStartDelay)
      }
    }, 300)
    return () => {
      clearInterval(poll)
      clearTimeout(timer)
    }
  }, [autoStart, enabled, seen, !!currentUser, signupInProgress, startTour, autoStartDelay])

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [])

  return { startTour, seen }
}
