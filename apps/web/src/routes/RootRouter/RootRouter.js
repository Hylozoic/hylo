import React, { Suspense, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Route, Routes, useNavigate } from 'react-router-dom'
import Loading from 'components/Loading'
import NavigateWithParams from 'components/NavigateWithParams'
import checkLogin from 'store/actions/checkLogin'
import { getAuthorized } from 'store/selectors/getAuthState'

// Lazy load layout routers to reduce initial bundle size
const AuthLayoutRouter = React.lazy(() => import('routes/AuthLayoutRouter'))
const JoinGroup = React.lazy(() => import('routes/JoinGroup'))
const NonAuthLayoutRouter = React.lazy(() => import('routes/NonAuthLayoutRouter'))
const OAuthLayoutRouter = React.lazy(() => import('routes/OAuth/OAuthLayoutRouter'))
const PublicLayoutRouter = React.lazy(() => import('routes/PublicLayoutRouter'))
const PublicGroupDetail = React.lazy(() => import('routes/PublicLayoutRouter/PublicGroupDetail'))
const PublicPostDetail = React.lazy(() => import('routes/PublicLayoutRouter/PublicPostDetail'))

// Mixpanel initialization moved to router/index.js for deferred loading

export default function RootRouter () {
  const dispatch = useDispatch()
  const isAuthorized = useSelector(getAuthorized)
  const navigate = useNavigate()

  // Optimistic auth: use cached state for instant render, revalidate in background
  const cachedAuth = localStorage.getItem('hylo-auth-state')
  const [loading, setLoading] = useState(cachedAuth === null) // Only show loading if no cache
  const [authChecked, setAuthChecked] = useState(false)

  // Background auth check - doesn't block rendering if we have cached state
  useEffect(() => {
    (async function () {
      await dispatch(checkLogin())
      setAuthChecked(true)
      setLoading(false)
      // Cache the auth state for next load
      localStorage.setItem('hylo-auth-state', isAuthorized ? '1' : '0')
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

  // Handle auth state mismatch: if cached state was wrong, redirect appropriately
  useEffect(() => {
    if (authChecked && cachedAuth !== null) {
      const wasAuthorized = cachedAuth === '1'
      const isCurrentlyAuthorized = isAuthorized

      // If user was logged out but cache said they were logged in, refresh to login
      if (wasAuthorized && !isCurrentlyAuthorized) {
        window.location.href = '/login'
      }
    }
  }, [authChecked, isAuthorized, cachedAuth])

  // If we have no cached auth and haven't checked yet, show loading
  if (loading) {
    return (
      <Loading type='fullscreen' />
    )
  }

  // Use isAuthorized from Redux if auth check complete, otherwise use cached state
  const shouldShowAuthLayout = authChecked ? isAuthorized : (cachedAuth === '1')

  if (shouldShowAuthLayout) {
    return (
      <Suspense fallback={<Loading type='fullscreen' />}>
        <Routes>
          {/* If authenticated we still need to do oauth stuff when requested */}
          <Route path='/oauth/*' element={<OAuthLayoutRouter />} />
          <Route path='*' element={<AuthLayoutRouter />} />
        </Routes>
      </Suspense>
    )
  }

  // Not authorized - show public routes
  if (!shouldShowAuthLayout) {
    return (
      <Suspense fallback={<Loading type='fullscreen' />}>
        <Routes>
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
      </Suspense>
    )
  }
}
