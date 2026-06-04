import React from 'react'
import { useNavigate, Navigate, Route, Routes } from 'react-router-dom'
import Div100vh from 'react-div-100vh'
import { POST_DETAIL_MATCH, GROUP_DETAIL_MATCH } from '@hylo/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import MapExplorer from 'routes/MapExplorer'
import PostDetail from 'routes/PostDetail'
import Stream from 'routes/Stream'
import AllTopics from 'routes/AllTopics'
import PublicPageHeader from './PublicPageHeader'

/** Same id as auth shell center column so `/public/*` streams match E2E and scroll targets */
function PublicCenterColumn ({ children }) {
  return (
    <div className='p-0 sm:p-2 relative min-h-1 h-full flex-1 overflow-y-auto overflow-x-hidden transition-all duration-450 bg-midground' id={CENTER_COLUMN_ID}>
      {children}
    </div>
  )
}

export default function PublicLayoutRouter (props) {
  return (
    <Div100vh className='flex flex-row items-stretch bg-midground'>
      <div className='flex-1 flex flex-col bg-midground'>
        <PublicPageHeader />
        <Routes>
          <Route index element={<Navigate to='groups' replace />} />
          <Route path='map/*' element={<MapExplorerLayoutRouter />} />
          <Route path='groups/*' element={<GroupExplorerLayoutRouter />} />
          <Route path='stream/*' element={<PublicCenterColumn><Stream context='public' /></PublicCenterColumn>} />
          <Route path='projects/*' element={<PublicCenterColumn><Stream context='public' view='projects' /></PublicCenterColumn>} />
          <Route path='proposals/*' element={<PublicCenterColumn><Stream context='public' view='proposals' /></PublicCenterColumn>} />
          <Route path='events/*' element={<PublicCenterColumn><Stream context='public' /></PublicCenterColumn>} />
          <Route path='topics/:topicName' element={<PublicCenterColumn><Stream context='public' /></PublicCenterColumn>} />
          <Route path='topics' element={<AllTopics />} />
          {/* Must be before `public/*` in AuthLayout; here match post editor paths if ever deep-linked unauth */}
          <Route path='post/:postId/edit/*' element={<PublicCenterColumn><Stream context='public' /></PublicCenterColumn>} />
          <Route path='post/:postId/create/*' element={<PublicCenterColumn><Stream context='public' /></PublicCenterColumn>} />

          {/* Unknown under /public — send to stream (same as auth shell), not login */}
          <Route path='*' element={<Navigate to='/public/stream' replace />} />
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
