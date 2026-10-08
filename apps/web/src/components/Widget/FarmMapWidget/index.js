import React, { Suspense } from 'react'
import Skeleton from 'components/Skeleton'

const FarmMapWidget = React.lazy(() => import('./FarmMapWidget'))

/** Farm home widget only — keeps map stack off pages without this widget type. */
export default function LazyFarmMapWidget (props) {
  return (
    <Suspense fallback={<Skeleton className='w-full min-h-[300px] rounded-lg' aria-label='Loading map' />}>
      <FarmMapWidget {...props} />
    </Suspense>
  )
}
