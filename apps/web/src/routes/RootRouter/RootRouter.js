import mixpanel from 'mixpanel-browser'
import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import config, { isProduction, isTest } from 'config/index'
import Loading from 'components/Loading'
import NavigateWithParams from 'components/NavigateWithParams'
import AuthLayoutRouter from 'routes/AuthLayoutRouter'
import NonAuthLayoutRouter from 'routes/NonAuthLayoutRouter'
import OAuthLogin from 'routes/OAuth/Login'
import PublicLayoutRouter from 'routes/PublicLayoutRouter'
import PublicGroupDetail from 'routes/PublicLayoutRouter/PublicGroupDetail'
import PublicPostDetail from 'routes/PublicLayoutRouter/PublicPostDetail'
import checkLogin from 'store/actions/checkLogin'
import { getAuthorized } from 'store/selectors/getAuthState'

if (!isTest) {
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
}

export default function RootRouter () {
  const dispatch = useDispatch()
  const isAuthorized = useSelector(getAuthorized)
  const [loading, setLoading] = useState(true)

  // This should be the only place we check for a session from the API.
  // Routes will not be available until this check is complete.
  useEffect(() => {
    (async function () {
      setLoading(true)
      await dispatch(checkLogin())
      setLoading(false)
    }())
  }, [dispatch, setLoading])

  if (loading) {
    return (
      <Loading type='fullscreen' />
    )
  }

  if (isAuthorized) {
    return (
      <Routes>
        {/* If authenticated and trying to do an oAuth login we need to still get an auth code from the server and redirect to redirect_url */}
        <Route path='/oauth/login/:uid' element={<OAuthLogin authenticated />} />
        {/* If authenticated and need to ask for oAuth consent again do so */}
        <Route
          path='/oauth/consent/:uid'
          element={<NonAuthLayoutRouter skipAuthCheck />}
        />

        <Route path='*' element={<AuthLayoutRouter />} />
      </Routes>
    )
  }
  if (!isAuthorized) {
    return (
      <Routes>
        <Route
          path='/public/*'
          element={<PublicLayoutRouter />}
        />

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

        {/* XXX: sending join page to non-auth layout router, before all other group pages go to the public group detail */}
        <Route path='/groups/:groupSlug/join/:accessCode/*' element={<NonAuthLayoutRouter />} />
        <Route path='/groups/:groupSlug/*' element={<PublicGroupDetail />} />

        <Route path='*' element={<NonAuthLayoutRouter />} />
      </Routes>
    )
  }
}
