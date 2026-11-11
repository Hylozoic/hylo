import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import orm from 'store/models'
import { generateStore } from 'util/testing/reactTestingLibraryExtended'
import Management from './Management'

jest.mock('./PlatformMetrics/PlatformMetrics', () => function PlatformMetrics () {
  return <div>Metrics</div>
})
jest.mock('./SiteBanners/SiteBanners', () => function SiteBanners () {
  return <div>Banners</div>
})
jest.mock('./CommonsRequests/CommonsRequests', () => function CommonsRequests () {
  return <div>Commons</div>
})
jest.mock('./StagingEmailTesters', () => function StagingEmailTesters () {
  return <div>Email testers</div>
})
jest.mock('./StripeAnalytics/StripeAnalytics', () => function StripeAnalytics () {
  return <div>Disputes</div>
})

/** Renders Management at a path for an admin or a regular member. */
function renderManagement (path, isAdmin) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', name: 'Ada', isAdmin })
  const store = generateStore({ orm: session.state })

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path='management/*' element={<Management />} />
          <Route path='all' element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
}

describe('Management access', () => {
  it('sends someone who is not a system admin home', () => {
    renderManagement('/management/metrics', false)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.queryByText('Metrics')).not.toBeInTheDocument()
  })

  it('opens metrics for a system admin', () => {
    renderManagement('/management', true)
    expect(screen.getByText('Metrics')).toBeInTheDocument()
  })

  it('keeps the previous metrics URL working for a system admin', () => {
    renderManagement('/management/platform/health', true)
    expect(screen.getByText('Metrics')).toBeInTheDocument()
  })
})
