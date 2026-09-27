import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { Route, Routes, useLocation, useParams } from 'react-router-dom'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import PublicGroupDetail from './PublicGroupDetail'

jest.mock('routes/GroupDetail', () => () => <div>Group detail</div>)
jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

function mockGroupViewable (group) {
  mockGraphqlServer.use(
    graphql.query('CheckIsGroupViewable', () => HttpResponse.json({ data: { group } }))
  )
}

function renderPublicGroupDetail () {
  return render(
    <Routes>
      <Route path='/groups/test-group' element={<PublicGroupDetail />} />
      <Route path='/login' element={<div>Login page</div>} />
    </Routes>,
    { wrapper: AllTheProviders({}, ['/groups/test-group']) }
  )
}

beforeEach(() => {
  useParams.mockReturnValue({ groupSlug: 'test-group' })
  useLocation.mockReturnValue({ pathname: '/groups/test-group', search: '' })
})

afterEach(() => {
  trackAnalyticsEvent.mockClear()
  useParams.mockReturnValue({})
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

it('tracks Public Group Viewed for a public group', async () => {
  mockGroupViewable({ id: '3', visibility: 2 })

  renderPublicGroupDetail()

  expect(await screen.findByText('Group detail')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Public Group Viewed', { groupId: '3', viaInvite: false })
})

it('tracks Public Group Viewed via an invitation for a restricted group', async () => {
  useLocation.mockReturnValue({ pathname: '/groups/test-group', search: '?accessCode=test-code' })
  mockGroupViewable({ id: '3', visibility: 1 })

  renderPublicGroupDetail()

  expect(await screen.findByText('Group detail')).toBeInTheDocument()
  expect(trackAnalyticsEvent).toHaveBeenCalledWith('Public Group Viewed', { groupId: '3', viaInvite: true })
})

it('tracks Login Wall Hit before sending a signed-out user to login', async () => {
  mockGroupViewable(null)

  renderPublicGroupDetail()

  expect(await screen.findByText('Login page')).toBeInTheDocument()
  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Login Wall Hit', { kind: 'group' })
  })
  expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Public Group Viewed', expect.anything())
})
