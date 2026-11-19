import React from 'react'
import { useSelector } from 'react-redux'
import { Routes, Route, Navigate } from 'react-router-dom'
import getMe from 'store/selectors/getMe'
import { getLastViewedGroupPath } from 'store/selectors/getLastViewedGroup'
import StagingEmailTesters from './StagingEmailTesters'
import StripeAnalytics from './StripeAnalytics/StripeAnalytics'
import SiteBanners from './SiteBanners/SiteBanners'
import CommonsRequests from './CommonsRequests/CommonsRequests'
import PlatformMetrics from './PlatformMetrics/PlatformMetrics'

/** Admin management screens. The menu lives in ContextMenu via getStaticMenuViews. */
export default function Management () {
  const currentUser = useSelector(getMe)
  const homePath = useSelector(getLastViewedGroupPath)

  if (!currentUser?.isAdmin) return <Navigate to={homePath} replace />

  return (
    <Routes>
      <Route path='email-testers' element={<StagingEmailTesters />} />
      <Route path='paid-content/stripe-analytics' element={<StripeAnalytics />} />
      <Route path='metrics' element={<PlatformMetrics />} />
      <Route path='banners' element={<SiteBanners />} />
      <Route path='commons-requests' element={<CommonsRequests />} />
      <Route path='staging/email-testers' element={<Navigate to='/management/email-testers' replace />} />
      <Route path='platform/health' element={<Navigate to='/management/metrics' replace />} />
      <Route path='site/banners' element={<Navigate to='/management/banners' replace />} />
      <Route path='site/commons-requests' element={<Navigate to='/management/commons-requests' replace />} />
      <Route path='' element={<Navigate to='metrics' replace />} />
    </Routes>
  )
}
