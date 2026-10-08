import React, { Suspense } from 'react'
import { MapExplorerBootstrapSkeleton } from 'components/Skeleton/RouteBootstrapPlaceholders'

const MapExplorer = React.lazy(() => import('./MapExplorer'))

/** Map routes only — keeps mapbox-gl, deck.gl, and MapExplorer UI off the default app chunk. */
export default function LazyMapExplorer (props) {
  return (
    <Suspense fallback={<MapExplorerBootstrapSkeleton />}>
      <MapExplorer {...props} />
    </Suspense>
  )
}
