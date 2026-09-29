import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { AnalyticsEvents } from '@hylo/shared'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import updateUserSettings from 'store/actions/updateUserSettings'
import { PROFILE_NUDGE_PENDING } from './profileNudgeState'

// The welcome wizard steps someone who signs up from an invitation skips
export const SKIPPED_WELCOME_STEPS = ['upload-photo', 'add-location']

/**
 * Someone who signed up from an invitation or join link skips the welcome wizard's photo
 * and location steps and goes straight back to the group (D16). This finishes their signup
 * on the server and asks for a photo and location later, after their first post
 * (ProfileNudge).
 *
 * It waits for the server to confirm before letting the caller go on: the session only
 * takes signupInProgress from a confirmed update, so the redirect to the invitation can't
 * race a fetch of the current user that still says signup is in progress. It runs once;
 * if the update fails, signup stays in progress and the person sees the usual welcome
 * wizard instead.
 *
 * @param {boolean} shouldFinish signup is in progress and the return path is an invitation
 * @param {object} [options]
 * @param {boolean} [options.ready] the current user has loaded, so the update can apply to it
 * @returns {{ finishing: boolean, finished: boolean }} finishing until the server has
 *   answered (from the first render on), finished once it confirmed
 */
export default function useFinishInviteSignup (shouldFinish, { ready = true } = {}) {
  const dispatch = useDispatch()
  const startedRef = useRef(false)
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!shouldFinish || !ready || startedRef.current) return
    startedRef.current = true
    setFinishing(true)
    Promise.resolve(dispatch(updateUserSettings({ settings: { signupInProgress: false, profileNudge: PROFILE_NUDGE_PENDING } })))
      .then(result => {
        if (result?.error) return
        // Only once the steps are really skipped: if the update fails, the person goes through the wizard
        SKIPPED_WELCOME_STEPS.forEach(step =>
          dispatch(trackAnalyticsEvent(AnalyticsEvents.WELCOME_WIZARD_STEP_SKIPPED, { step, reason: 'invite' })))
        dispatch(trackAnalyticsEvent(AnalyticsEvents.SIGNUP_COMPLETE))
        setFinished(true)
      })
      .catch(() => {})
      .finally(() => setFinishing(false))
  }, [dispatch, shouldFinish, ready])

  return {
    // Also from the first render, until the effect has started the update
    finishing: finishing || (shouldFinish && !startedRef.current),
    finished
  }
}
