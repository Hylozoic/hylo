import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import orm from 'store/models'
import { AllTheProviders, render, waitFor } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import GroupWelcomePage from './GroupWelcomePage'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

afterEach(() => {
  trackAnalyticsEvent.mockClear()
  useParams.mockReturnValue({})
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

it('tracks Group Welcome Page Viewed for the group', async () => {
  useParams.mockReturnValue({ groupSlug: 'welcome-group' })
  useLocation.mockReturnValue({ pathname: '/groups/welcome-group/welcome', search: '' })
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Group.create({ id: '4', name: 'Welcome Group', slug: 'welcome-group' })

  render(<GroupWelcomePage />, { wrapper: AllTheProviders({ orm: ormSession.state }) })

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Welcome Page Viewed', { groupId: '4' })
  })
})
