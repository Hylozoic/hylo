import React from 'react'
import { useLocation, useNavigate, Navigate, Route, Routes } from 'react-router-dom'
import Div100vh from 'react-div-100vh'
import { POST_DETAIL_MATCH, GROUP_DETAIL_MATCH } from '@hylo/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import MapExplorer from 'routes/MapExplorer'
import PostDetail from 'routes/PostDetail'
import PublicPageHeader from './PublicPageHeader'

export default function PublicLayoutRouter (props) {
  const location = useLocation()

  return (
    <Div100vh className='flex flex-row items-stretch bg-midground'>
      <div className='flex-1 flex flex-col bg-midground'>
        <PublicPageHeader />
        <Routes>
          <Route path='map/*' element={<MapExplorerLayoutRouter />} />
          <Route path='groups/*' element={<GroupExplorerLayoutRouter />} />

          {/* Redirect all other routes to /login */}
          <Route element={<Navigate to='/login' state={{ from: location }} replace />} />
        </Routes>
      </div>
    </Div100vh>
  )
}

function MapExplorerLayoutRouter (props) {
  const navigate = useNavigate()

  return (
    <>
      <div className='p-0 sm:p-2 relative min-h-1 h-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-450 bg-midground' id={CENTER_COLUMN_ID}>
        <MapExplorer {...props} navigate={navigate} />
      </div>
      <Routes>
        <Route
          path={POST_DETAIL_MATCH}
          element={
            <div className='bg-background absolute z-30 top-0 right-0 h-screen w-[420px] shadow-2xl transition-all duration-200 delay-100 pb-[50px] overflow-y-auto overflow-x-hidden' id={DETAIL_COLUMN_ID}>
              <PostDetail />
            </div>
          }
        />
        <Route
          path={GROUP_DETAIL_MATCH}
          element={
            <div className='bg-white absolute z-30 top-0 right-0 h-screen w-[420px] shadow-2xl transition-all duration-200 delay-100 pb-[50px] overflow-y-auto overflow-x-hidden' id={DETAIL_COLUMN_ID}>
              <GroupDetail context='public' />
            </div>
          }
        />
      </Routes>
    </>
  )
}

function GroupExplorerLayoutRouter () {
  return (
    <>
      <div className='p-0 sm:p-2 relative min-h-1 h-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-450 bg-midground mt-4' id={CENTER_COLUMN_ID}>
        <div>
          <GroupExplorer />
        </div>
      </div>
      <Routes>
        <Route
          path={GROUP_DETAIL_MATCH}
          element={
            <div className='bg-white absolute z-30 top-0 right-0 h-screen w-[420px] shadow-2xl transition-all duration-200 delay-100 pb-[50px] overflow-y-auto overflow-x-hidden' id={DETAIL_COLUMN_ID}>
              <GroupDetail context='public' />
            </div>
          }
        />
      </Routes>
    </>
  )
}
