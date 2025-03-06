import React from 'react'
import { useLocation, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import getLastViewedGroup from 'store/selectors/getLastViewedGroup'
import { getAuthenticated } from 'store/selectors/getAuthState'

export default function DefaultRoute () {
  const location = useLocation()
  const isAuthenticated = useSelector(getAuthenticated)
  const lastViewedGroup = useSelector(getLastViewedGroup)

  console.log('default route isAuthenticated', isAuthenticated)
  if (isAuthenticated) {
    return <Navigate to={lastViewedGroup ? `/groups/${lastViewedGroup.slug}` : '/all'} replace />
  } else {
    /*
      Default route
      NOTE: This passes the unmatched location for anything unmatched except `/`
      into `location.state.from` which persists navigation and will be set as the
      returnToPath in the `useEffect` in this component. This shouldn't interfere
      with the static pages as those routes are first use `path='/(.+)'` to match
      anything BUT root if there is any issue.
    */
    return <Navigate to='/login' state={{ from: location }} replace />
  }
}
