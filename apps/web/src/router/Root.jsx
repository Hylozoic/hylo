import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import checkLogin from 'store/actions/checkLogin'

// const App = React.lazy(() => import('./App'))
// const HyloEditorMobile = React.lazy(() => import('routes/HyloEditorMobile'))
// const Feature = React.lazy(() => import('components/PostCard/Feature'))

export default function Root () {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(checkLogin())
  }, [])

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
