import React from 'react'
import { cn } from 'util/index'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import NavColumnSkeleton from './NavColumnSkeleton'
import ViewHeaderSkeleton from './ViewHeaderSkeleton'
import RouteBootstrapSkeleton from './RouteBootstrapSkeleton'

/**
 * App chrome (nav rail + header + scrollable center) with route-aware skeleton content.
 * Used when a parent blocks real routes: RootRouter session check, AuthLayoutRouter user bootstrap.
 * Renders under `HistoryRouter`, so the inner skeleton can use `useLocation()`; optional `pathname`
 * forces the active route shape (e.g. tests).
 */
export default function BootstrapShell ({ withoutNav = false, className, pathname }) {
  return (
    <div
      className={cn(
        'flex flex-col h-full min-h-0 w-full overflow-hidden bg-midground',
        className
      )}
      data-testid='bootstrap-shell'
    >
      <div className='flex flex-row flex-1 min-h-0 w-full overflow-hidden relative'>
        {!withoutNav && <NavColumnSkeleton />}
        <div className='flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden'>
          <ViewHeaderSkeleton />
          <div
            id={CENTER_COLUMN_ID}
            className='flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden'
          >
            {/* RouteBootstrapSkeleton applies stream (750px) or post (960px) column width */}
            <div className='flex-1 w-full min-h-0 pb-6'>
              <RouteBootstrapSkeleton pathname={pathname} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
