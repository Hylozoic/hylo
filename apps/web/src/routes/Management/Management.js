import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ManagementContextMenu from './ManagementContextMenu'
import StagingEmailTesters from './StagingEmailTesters'

export default function Management () {
  return (
    <div className='flex h-full'>
      <ManagementContextMenu />
      <div className='flex-1'>
        <Routes>
          <Route path='staging/email-testers' element={<StagingEmailTesters />} />
          <Route path='' element={<Navigate to='staging/email-testers' replace />} />
        </Routes>
      </div>
    </div>
  )
}
