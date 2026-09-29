import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { AnalyticsEvents } from '@hylo/shared'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { getSignupComplete } from 'store/selectors/getSignupState'
import { GOOGLE_PLAY_APP_URL, androidIntentUrl, isAndroidBrowser } from 'util/mobile'
import isWebView from 'util/webView'

export const DISMISS_STORAGE_KEY = 'hylo:appInstallPrompt:dismissedAt'

// Mid-flow pages where the prompt would pull people away from finishing
const MID_FLOW_PATH = /(^\/signup)|(\/join\/)|(\/welcome(\/|$))|(^\/h\/(use-)?invitation)/

export function readDismissed () {
  try {
    return !!window.localStorage.getItem(DISMISS_STORAGE_KEY)
  } catch (e) {
    return false
  }
}

function rememberDismissed () {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, new Date().toISOString())
  } catch (e) {
    // Private windows can refuse storage; the prompt then just hides for this visit
  }
}

/**
 * Whether to offer the Android app: only in an Android browser (never inside
 * the Hylo app or another app's WebView), only once signup is finished and the
 * person is in at least one group, never mid-flow, and never after they've
 * dismissed or used it.
 */
export function shouldShowAppInstallPrompt ({ userAgent, inWebView, signupComplete, membershipCount, dismissed, pathname }) {
  if (inWebView || dismissed) return false
  if (!isAndroidBrowser(userAgent)) return false
  if (!signupComplete || !(membershipCount > 0)) return false
  if (MID_FLOW_PATH.test(pathname || '')) return false
  return true
}

/**
 * A small card at the bottom of the screen on Android browsers offering to
 * open this page in the Hylo app (falling back to the Play Store) or install it.
 */
export default function AppInstallPrompt ({ userAgent }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const signupComplete = useSelector(getSignupComplete)
  const memberships = useSelector(getMyMemberships)
  const [dismissed, setDismissed] = useState(readDismissed)
  const shownTracked = useRef(false)

  const visible = shouldShowAppInstallPrompt({
    userAgent: userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    inWebView: !!isWebView() || (typeof window !== 'undefined' && !!window.HyloMobileV2),
    signupComplete,
    membershipCount: memberships.length,
    dismissed,
    pathname: location.pathname
  })

  useEffect(() => {
    if (visible && !shownTracked.current) {
      shownTracked.current = true
      dispatch(trackAnalyticsEvent(AnalyticsEvents.APP_INSTALL_PROMPT_SHOWN))
    }
  }, [visible, dispatch])

  const close = useCallback((eventName) => {
    rememberDismissed()
    setDismissed(true)
    dispatch(trackAnalyticsEvent(eventName))
  }, [dispatch])

  if (!visible) return null

  const openUrl = androidIntentUrl(window.location.href)

  return (
    <div
      className='fixed inset-x-0 bottom-0 z-[80] px-4 pb-4 pointer-events-none'
      data-testid='app-install-prompt'
    >
      <div
        role='region'
        aria-label={t('Hylo app')}
        className='pointer-events-auto mx-auto max-w-md rounded-xl border-2 border-foreground/10 bg-card shadow-2xl p-4 flex items-start gap-3'
      >
        <img src='/hylo-merkaba.png' alt='' className='w-10 h-10 rounded-lg my-0 shrink-0' />
        <div className='flex-1 min-w-0'>
          <p className='font-bold text-foreground text-sm m-0'>{t('Hylo is better in the app')}</p>
          <p className='text-foreground/70 text-xs mt-1 mb-3'>{t('appInstallPromptBody')}</p>
          <div className='flex flex-wrap gap-2'>
            {openUrl && (
              <a
                href={openUrl}
                onClick={() => close(AnalyticsEvents.APP_INSTALL_PROMPT_OPENED)}
                className='bg-selected text-foreground font-bold text-sm px-3 py-1.5 rounded-md hover:bg-selected/85'
              >
                {t('Open in app')}
              </a>
            )}
            <a
              href={GOOGLE_PLAY_APP_URL}
              target='_blank'
              rel='noopener noreferrer'
              onClick={() => close(AnalyticsEvents.APP_INSTALL_PROMPT_INSTALL_CLICKED)}
              className='border-2 border-foreground/20 text-foreground text-sm px-3 py-1 rounded-md hover:border-foreground/50'
            >
              {t('Install')}
            </a>
          </div>
        </div>
        <button
          type='button'
          aria-label={t('Dismiss')}
          onClick={() => close(AnalyticsEvents.APP_INSTALL_PROMPT_DISMISSED)}
          className='p-1 rounded-full text-foreground/60 hover:text-foreground shrink-0'
        >
          <X className='w-4 h-4' />
        </button>
      </div>
    </div>
  )
}
