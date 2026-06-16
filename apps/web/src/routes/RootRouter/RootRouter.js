import mixpanel from 'mixpanel-browser'
import { WebViewMessageTypes } from '@hylo/shared'
import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { connectSocket } from 'client/websockets'
import config, { debugCheckLogin, isProduction, isTest } from 'config/index'
import Loading from 'components/Loading'
import BootstrapShell from 'components/Skeleton/BootstrapShell'
import NavigateWithParams from 'components/NavigateWithParams'
import AuthLayoutRouter from 'routes/AuthLayoutRouter'
import JoinGroup from 'routes/JoinGroup'
import NonAuthLayoutRouter from 'routes/NonAuthLayoutRouter'
import OAuthLayoutRouter from 'routes/OAuth/OAuthLayoutRouter'
import PublicLayoutRouter from 'routes/PublicLayoutRouter'
import PublicGroupDetail from 'routes/PublicLayoutRouter/PublicGroupDetail'
import PublicPostDetail from 'routes/PublicLayoutRouter/PublicPostDetail'
import OfferingDetails from 'routes/OfferingDetails/OfferingDetails'
import checkLogin from 'store/actions/checkLogin'
import { getAuthorized } from 'store/selectors/getAuthState'
import { sendMessageToWebView } from 'util/webView'

if (!isTest && config.mixpanel.token) {
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
}

// In the v2 mobile WebView, a failed auth check is almost always a transient cookie
// desync (e.g. social-login resume), NOT a real logout. Ask native to re-establish
// the session from its token and reload us, retrying a bounded number of times before
// concluding the native session is genuinely gone.
const MOBILE_REAUTH_ATTEMPTS_KEY = 'hyloMobileReauthAttempts'
const MOBILE_RECOVERING_KEY = 'hyloMobileRecovering'
const MAX_MOBILE_REAUTH_ATTEMPTS = 3

function readMobileRecovering () {
  try {
    return window.localStorage?.getItem(MOBILE_RECOVERING_KEY) === '1'
  } catch (e) {
    return false
  }
}

function writeMobileRecovering (recovering) {
  try {
    if (recovering) window.localStorage?.setItem(MOBILE_RECOVERING_KEY, '1')
    else window.localStorage?.removeItem(MOBILE_RECOVERING_KEY)
  } catch (e) { /* storage unavailable */ }
}

function readMobileReauthAttempts () {
  try {
    return parseInt(window.localStorage?.getItem(MOBILE_REAUTH_ATTEMPTS_KEY) || '0', 10) || 0
  } catch (e) {
    return 0
  }
}

function writeMobileReauthAttempts (n) {
  try {
    if (n === 0) window.localStorage?.removeItem(MOBILE_REAUTH_ATTEMPTS_KEY)
    else window.localStorage?.setItem(MOBILE_REAUTH_ATTEMPTS_KEY, String(n))
  } catch (e) { /* storage unavailable — re-auth simply won't be bounded */ }
}

/**
 * During `checkLogin`, avoid BootstrapShell (logged-in nav + feed-shaped skeleton) for URLs
 * that render login, signup, or other non-auth layouts so the flash matches those pages.
 */
function isNeutralRootSessionLoadingPath (pathname) {
  if (pathname === '/' || pathname === '/login' || pathname === '/reset-password' || pathname === '/notifications') {
    return true
  }
  if (pathname.startsWith('/signup')) return true
  if (pathname === '/public' || pathname.startsWith('/public/')) return true
  if (pathname.startsWith('/post/')) return true
  if (pathname.startsWith('/oauth/')) return true
  if (pathname === '/h/use-invitation') return true
  if (pathname.includes('/join/')) return true
  // Single-segment paths that are not obvious “main app” entry slugs resolve to non-auth (e.g. → /login); avoid auth-shaped skeleton while checkLogin runs
  const oneSeg = pathname.match(/^\/([^/]+)$/)
  if (oneSeg) {
    const slug = oneSeg[1]
    const mainAppRootSlugs = new Set(['groups', 'all', 'my', 'members', 'post', 'public', 'oauth', 'h'])
    if (!mainAppRootSlugs.has(slug)) return true
  }
  return false
}

export default function RootRouter () {
  const dispatch = useDispatch()
  const isAuthorized = useSelector(getAuthorized)
  const [loading, setLoading] = useState(true)
  const [mobileRecovering, setMobileRecovering] = useState(
    () => typeof window !== 'undefined' && window.HyloMobileV2 && readMobileRecovering()
  )
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // This should be the only place we check for a session from the API.
  const runCheckLogin = useCallback(async () => {
    setLoading(true)
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const action = await dispatch(checkLogin())
      const me = action?.payload?.data?.me
      if (debugCheckLogin) {
        const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        console.info('[Hylo checkLogin]', `${ms}ms`, {
          hasMe: !!me,
          pathname: typeof window !== 'undefined' ? window.location.pathname : ''
        })
      }
    } catch (err) {
      if (debugCheckLogin) {
        const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
        console.info('[Hylo checkLogin]', `${ms}ms`, 'error', err?.message || err, {
          pathname: typeof window !== 'undefined' ? window.location.pathname : ''
        })
      }
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    runCheckLogin()

    // For navigation to work from notifactions in the electron app
    if (window.electron && window.electron.onNavigateTo) {
      window.electron.onNavigateTo((url) => {
        // Optionally, strip the host if present
        // For example, if url is '/groups/123', just navigate(url)
        // If url is 'https://hylo.com/groups/123', extract the path
        let path = url
        try {
          const u = new URL(url)
          path = u.pathname + u.search + u.hash
        } catch (e) {
          // url is likely already a path
        }
        navigate(path)
      })
    }
  }, [runCheckLogin, navigate])

  // Native re-minted the session cookie — re-run checkLogin without a full page reload.
  useEffect(() => {
    if (!window.HyloMobileV2) return

    const handleNativeMessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type !== WebViewMessageTypes.SESSION_READY) return
        runCheckLogin()
      } catch (e) { /* non-JSON postMessage */ }
    }

    window.addEventListener('message', handleNativeMessage, true)
    return () => window.removeEventListener('message', handleNativeMessage, true)
  }, [runCheckLogin])

  // Mobile WebView re-auth handshake. Once checkLogin has resolved:
  // - authorized → reset counters and open the socket.
  // - unauthorized → ask native to re-mint the session (VERIFY_AUTH). Native syncs
  //   cookies and posts SESSION_READY so we can retry in place. After MAX failures,
  //   send LOGOUT so native shows its login UI.
  useEffect(() => {
    if (loading) return
    if (!window.HyloMobileV2) return

    if (isAuthorized) {
      writeMobileReauthAttempts(0)
      writeMobileRecovering(false)
      setMobileRecovering(false)
      sendMessageToWebView(WebViewMessageTypes.AUTH_SUCCESS)
      connectSocket()
      return
    }

    writeMobileRecovering(true)
    setMobileRecovering(true)
    const attempts = readMobileReauthAttempts()
    if (attempts >= MAX_MOBILE_REAUTH_ATTEMPTS) {
      writeMobileReauthAttempts(0)
      writeMobileRecovering(false)
      setMobileRecovering(false)
      sendMessageToWebView(WebViewMessageTypes.LOGOUT)
      return
    }
    writeMobileReauthAttempts(attempts + 1)
    sendMessageToWebView(WebViewMessageTypes.VERIFY_AUTH)
  }, [loading, isAuthorized])

  if (loading || mobileRecovering) {
    if (window.HyloMobileV2 || isNeutralRootSessionLoadingPath(pathname)) {
      return <Loading type='fullscreen' />
    }
    return <BootstrapShell />
  }

  if (isAuthorized) {
    return (
      <Routes>
        {/* If authenticated we still need to do oauth stuff when requested */}
        <Route path='/oauth/*' element={<OAuthLayoutRouter />} />
        <Route path='*' element={<AuthLayoutRouter />} />
      </Routes>
    )
  }
  // In the v2 mobile WebView, native owns auth (token-based) and is the source of truth.
  // Stay on a single fullscreen spinner during cookie recovery instead of flashing the page.
  if (!isAuthorized && window.HyloMobileV2) {
    return <Loading type='fullscreen' />
  }

  if (!isAuthorized) {
    return (
      <Routes>
        <Route path='/' element={<Navigate to='/login' replace />} />

        <Route
          path='/public/*'
          element={<PublicLayoutRouter />}
        />

        <Route path='/oauth/*' element={<OAuthLayoutRouter />} />

        <Route path='/post/:postId/*' element={<PublicPostDetail />} />

        {/* Redirect all other post routes to /post/:postId */}
        <Route path='/all/topics/:topicName/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/all/members/:personId/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/all/:view/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/all/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/public/topics/:topicName/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/public/:view/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/public/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/my/:view/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/members/:personId/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/custom/:customViewId/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/members/:personId/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/topics/:topicName/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/:view/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/chat/:topicName/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />
        <Route path='/groups/:groupSlug/post/:postId' element={<NavigateWithParams to={params => `/post/${params.postId}`} replace />} />

        {/* XXX: sending join page directly to JoinGroup, before all other group pages go to the public group detail */}
        <Route path='/groups/:groupSlug/join/:accessCode/*' element={<JoinGroup />} />
        {/* Must be before `/groups/:groupSlug/*` → PublicGroupDetail so offering URLs resolve here */}
        <Route path='/groups/:groupSlug/offerings/:offeringId' element={<OfferingDetails />} />
        <Route path='/groups/:groupSlug/*' element={<PublicGroupDetail />} />

        <Route path='*' element={<NonAuthLayoutRouter />} />
      </Routes>
    )
  }
}
