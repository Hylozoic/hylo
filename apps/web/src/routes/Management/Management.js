import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ManagementContextMenu from './ManagementContextMenu'
import StagingEmailTesters from './StagingEmailTesters'
import StripeAnalytics from './StripeAnalytics/StripeAnalytics'
import SiteBanners from './SiteBanners/SiteBanners'
import OrphanedGroups from './OrphanedGroups/OrphanedGroups'
import DeletedGroups from './DeletedGroups/DeletedGroups'
import ExplorerReview from './ExplorerReview/ExplorerReview'
import ReportQueue from './ReportQueue/ReportQueue'

export default function Management () {
  return (
    <div className='flex h-full'>
      <ManagementContextMenu />
      <div className='flex-1'>
        <Routes>
          <Route path='staging/email-testers' element={<StagingEmailTesters />} />
          <Route path='paid-content/stripe-analytics' element={<StripeAnalytics />} />
          <Route path='site/banners' element={<SiteBanners />} />
          <Route path='groups/without-administrator' element={<OrphanedGroups />} />
          <Route path='groups/deleted' element={<DeletedGroups />} />
          <Route path='site/new-public-groups' element={<ExplorerReview />} />
          <Route path='safety/reports' element={<ReportQueue />} />
          <Route path='' element={<Navigate to='staging/email-testers' replace />} />
        </Routes>
      </div>
    </div>
  )
}
