import { cn } from 'util/index'
import React from 'react'
import { useParams, useLocation, useNavigate, Navigate, Route, Routes } from 'react-router-dom'
import Div100vh from 'react-div-100vh'
import { POST_DETAIL_MATCH, GROUP_DETAIL_MATCH } from 'util/navigation'
import { CENTER_COLUMN_ID, DETAIL_COLUMN_ID } from 'util/scrolling'
import HyloCookieConsent from 'components/HyloCookieConsent'
import GroupDetail from 'routes/GroupDetail'
import GroupExplorer from 'routes/GroupExplorer'
import MapExplorer from 'routes/MapExplorer'
import PostDetail from 'routes/PostDetail'
import PublicPageHeader from './PublicPageHeader'
import classes from './PublicLayoutRouter.module.scss'

export default function PublicLayoutRouter (props) {
  const routeParams = useParams()
  const location = useLocation()
  const isMapView = routeParams?.view === 'map'

  return (
    <Div100vh className={cn(classes.publicContainer, { [classes.mapView]: isMapView })}>
      <PublicPageHeader />
      <Routes>
        <Route path='map/*' element={<MapExplorerLayoutRouter />} />
        <Route path='groups/*' element={<GroupExplorerLayoutRouter />} />

        {/* Redirect all other routes to /login */}
        <Route element={<Navigate to='/login' state={{ from: location }} replace />} />
      </Routes>
      <HyloCookieConsent />
    </Div100vh>
  )
}

function MapExplorerLayoutRouter (props) {
  const navigate = useNavigate()

  return (
    <>
      <div className={cn(classes.centerColumn, classes.mapView)} id={CENTER_COLUMN_ID}>
        <MapExplorer {...props} navigate={navigate} />
      </div>
      <Routes>
        <Route
          path={POST_DETAIL_MATCH}
          element={
            <div className={classes.detail} id={DETAIL_COLUMN_ID}>
              <PostDetail />
            </div>
          }
        />
        <Route
          path={GROUP_DETAIL_MATCH}
          element={
            <div className={classes.detail} id={DETAIL_COLUMN_ID}>
              <GroupDetail />
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
      <div className={cn(classes.centerColumn, classes.nonMapView)} id={CENTER_COLUMN_ID}>
        <div>
          <GroupExplorer />
        </div>
      </div>
      <Routes>
        <Route
          path={GROUP_DETAIL_MATCH}
          element={
            <div className={classes.detail} id={DETAIL_COLUMN_ID}>
              <GroupDetail />
            </div>
          }
        />
      </Routes>
    </>
  )
}
