import mixpanel from 'mixpanel-browser'
import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
import checkLogin from 'store/actions/checkLogin'
import { getAuthorized } from 'store/selectors/getAuthState'

if (!isTest && config.mixpanel.token) {
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
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
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // This should be the only place we check for a session from the API.
  // Routes will not be available until this check is complete.
  useEffect(() => {
    (async function () {
      setLoading(true)
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const action = await dispatch(checkLogin())
        // If the server returns me: null the session/cookie is dead. Clear the
        // persisted ORM (which may still have a stale Me row) so the app does not
        // briefly appear authenticated on the next load before checkLogin resolves.
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
      } finally {
        setLoading(false)
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

  if (loading) {
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
  // NOT log the native app out — only an explicit user-initiated logout sends LOGOUT (see
  // GlobalNav/ContextMenu). Render a neutral loading state instead of the web login page;
  // native's own token check surfaces the native login screen if the session is truly gone.
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
        <Route path='/groups/:groupSlug/*' element={<PublicGroupDetail />} />

        <Route path='*' element={<NonAuthLayoutRouter />} />
      </Routes>
    )
  }
}
