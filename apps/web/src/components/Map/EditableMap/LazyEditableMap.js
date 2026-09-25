import React, { Suspense } from 'react'
import Skeleton from 'components/Skeleton'

const EditableMap = React.lazy(() => import('./EditableMap'))

/** Defers mapbox-gl until group location settings render the boundary map. */
export default function LazyEditableMap (props) {
  return (
    <Suspense fallback={<Skeleton className='w-full h-full min-h-[275px] rounded-lg' aria-label='Loading map' />}>
      <EditableMap {...props} />
    </Suspense>
  )
}
