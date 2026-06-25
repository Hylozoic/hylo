import mixpanel from 'mixpanel-browser'
import { WebViewMessageTypes } from '@hylo/shared'
import React, { useEffect } from 'react'
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
import { getAuthSessionUnknown } from 'store/selectors/getAuthSession'
import { sendMessageToWebView } from 'util/webView'

if (!isTest && config.mixpanel.token) {
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
}

// In the v2 mobile WebView, a failed auth check is almost always a transient cookie
// desync (e.g. social-login resume), NOT a real logout. Ask native to re-establish
// the session from its token and reload us, retrying a bounded number of times before
// concluding the native session is genuinely gone.
const MOBILE_REAUTH_ATTEMPTS_KEY = 'hyloMobileReauthAttempts'
const MAX_MOBILE_REAUTH_ATTEMPTS = 3

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
  const isAuthSessionUnknown = useSelector(getAuthSessionUnknown)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // This should be the only place we check for a session from the API.
  // Routes will not be available until this check is complete.
  useEffect(() => {
    (async function () {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const action = await dispatch(checkLogin())
        // If the server returns me: null the session/cookie is dead. The
        // authSession reducer already records Anonymous from CHECK_LOGIN, so the
        // separated auth state drives routing without dispatching logout here.
        const me = action?.payload?.data?.me
        if (debugCheckLogin) {
          const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
          console.info('[Hylo checkLogin]', `${ms}ms`, { hasMe: !!me, pathname })
        }
        // Explicit `me: null` only — `undefined` has cleared valid sessions when the payload shape was wrong.
        // XXXX: This breaks logging in production only. Why???
        // if (me === null) dispatch(logout())
      } catch (err) {
        if (debugCheckLogin) {
          const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0)
          console.info('[Hylo checkLogin]', `${ms}ms`, 'error', err?.message || err, { pathname })
        }
        // XXXX: This breaks logging in production only. Why???
        // dispatch(logout())
      }
    }())

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
  }, [])

  // Mobile WebView re-auth handshake. Once checkLogin has resolved:
  // - authorized → reset the attempt counter (healthy session).
  // - unauthorized inside the v2 WebView → ask native to re-mint the session from
  //   its token and reload us (VERIFY_AUTH). After MAX attempts without success the
  //   native session really is gone, so send LOGOUT to let native show its login UI.
  // Non-mobile web is unaffected (window.HyloMobileV2 is undefined → falls through).
  useEffect(() => {
    if (isAuthSessionUnknown) return
    if (!window.HyloMobileV2) return

    if (isAuthorized) {
      writeMobileReauthAttempts(0)
      sendMessageToWebView(WebViewMessageTypes.AUTH_SUCCESS)
      connectSocket()
      return
    }

    const attempts = readMobileReauthAttempts()
    if (attempts >= MAX_MOBILE_REAUTH_ATTEMPTS) {
      writeMobileReauthAttempts(0)
      sendMessageToWebView(WebViewMessageTypes.LOGOUT)
      return
    }
    writeMobileReauthAttempts(attempts + 1)
    sendMessageToWebView(WebViewMessageTypes.VERIFY_AUTH)
  }, [isAuthSessionUnknown, isAuthorized])

  if (isAuthSessionUnknown) {
    if (isNeutralRootSessionLoadingPath(pathname)) {
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
  // A passive auth-check miss here (e.g. a transient WebView cookie desync on resume) must
  // NOT log the native app out. The effect above drives the recovery handshake (VERIFY_AUTH
  // → native re-mints the session and reloads); we just render a neutral loading state while
  // that round-trips, instead of the web login page.
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
