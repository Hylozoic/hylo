import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import Loading from 'components/Loading'
import checkLogin from 'store/actions/checkLogin'

// const App = React.lazy(() => import('./App'))
// const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
// const Feature = React.lazy(() => import('components/PostCard/Feature'))

export default function Root () {
  const dispatch = useDispatch()
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

  // if (authenticated && !me) {
  //   // If we are requiring auth and we are not logged in, redirect to the login page
  //   return <Navigate to='/login' />
  // } else if (!authenticated && me) {
  //   // If we are not requiring auth and we are logged in, redirect to the home page
  //   return <Navigate to='/' />
  // } else {
  //   // Otherwise, render the protected route
  //   return <Outlet />
  // }

  return <Outlet />

  // switch (window.location.pathname) {
  //   case '/hyloApp/editor': {
  //     return (
  //       <Suspense fallback={null}>
  //         <HyloEditorMobile />
  //       </Suspense>
  //     )
  //   }

  //   case '/hyloApp/videoPlayer': {
  //     const querystringParams = new URLSearchParams(window.location.search)

  //     return (
  //       <Suspense fallback={null}>
  //         <Feature url={querystringParams.get('url')} />
  //       </Suspense>
  //     )
  //   }

  //   default: {
  //     return (
  //       <Suspense fallback={<Loading type='fullscreen' />}>
  //         <App />
  //       </Suspense>
  //     )
  //   }
  // }
}
