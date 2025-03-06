import React from 'react'
import { useParams, useLocation, useNavigate, Navigate, Route, Routes, Outlet } from 'react-router-dom'
import Div100vh from 'react-div-100vh'
import { POST_DETAIL_MATCH, GROUP_DETAIL_MATCH } from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import HyloCookieConsent from 'components/HyloCookieConsent'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import MapExplorer from 'routes/MapExplorer'
import PostDetail from 'routes/PostDetail'
import PublicPageHeader from './PublicPageHeader'
import { cn } from 'util/index'

import classes from './PublicLayoutRouter.module.scss'

export default function PublicLayoutRouter (props) {
  const routeParams = useParams()
  const location = useLocation()
  const isMapView = routeParams?.view === 'map'

  return (
    <Div100vh className={cn(classes.publicContainer, { [classes.mapView]: isMapView })}>
      <PublicPageHeader />
      <div className={cn(classes.centerColumn, { [classes.mapView]: isMapView, [classes.nonMapView]: !isMapView })} id={CENTER_COLUMN_ID}>
        <Outlet />
      </div>
      <HyloCookieConsent />
    </Div100vh>
  )
}

//       <Routes>
//         <Route
//           path={POST_DETAIL_MATCH}
//           element={
//             <div className={classes.detail} id={DETAIL_COLUMN_ID}>
//               <PostDetail />
//             </div>
//           }
//         />
//         <Route
//           path={GROUP_DETAIL_MATCH}
//           element={
//             <div className={classes.detail} id={DETAIL_COLUMN_ID}>
//               <GroupDetail />
//             </div>
//           }
//         />
//       </Routes>
//     </>
//   )
// }

// function GroupExplorerLayoutRouter () {
//   return (
//     <>
//       <div className={cn(classes.centerColumn, classes.nonMapView)} id={CENTER_COLUMN_ID}>
//         <div>
//           <GroupExplorer />
//         </div>
//       </div>
//       <Routes>
//         <Route
//           path={GROUP_DETAIL_MATCH}
//           element={
//             <div className={classes.detail} id={DETAIL_COLUMN_ID}>
//               <GroupDetail />
//             </div>
//           }
//         />
//       </Routes>
//     </>
//   )
// }
