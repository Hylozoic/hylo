import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import orm from 'store/models'
import { fireEvent } from '@testing-library/react'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
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

describe('Introduce yourself', () => {
  function providers ({ member = true, track = false } = {}) {
    const session = orm.mutableSession(orm.getEmptyState())
    session.Me.create({ id: '1', name: 'Test User' })
    session.Group.create({ id: '4', name: 'Welcome Group', slug: 'welcome-group', groupViews: [], track: track ? { id: '9' } : null })
    if (member) session.Membership.create({ id: 'm4', person: '1', group: '4' })
    return AllTheProviders({ orm: session.state })
  }

  beforeEach(() => {
    useParams.mockReturnValue({ groupSlug: 'welcome-group' })
    useLocation.mockReturnValue({ pathname: '/groups/welcome-group/welcome', search: '' })
  })

  it('offers members an introduction that opens the composer with the template', async () => {
    render(<GroupWelcomePage />, { wrapper: providers() })

    fireEvent.click(await screen.findByTestId('welcome-page-introduce-yourself'))

    const opened = new URL(window.location.href)
    expect(opened.pathname).toBe('/groups/welcome-group/welcome')
    expect(opened.searchParams.get('template')).toBe('intro')
    expect(opened.searchParams.get('composerEntry')).toBe('welcome')
  })

  it('is not offered to non-members or on a track\'s welcome page', async () => {
    const { unmount } = render(<GroupWelcomePage />, { wrapper: providers({ member: false }) })
    await waitFor(() => expect(trackAnalyticsEvent).toHaveBeenCalled())
    expect(screen.queryByTestId('welcome-page-introduce-yourself')).not.toBeInTheDocument()
    unmount()

    render(<GroupWelcomePage />, { wrapper: providers({ track: true }) })
    await screen.findByText('Begin')
    expect(screen.queryByTestId('welcome-page-introduce-yourself')).not.toBeInTheDocument()
  })
})
