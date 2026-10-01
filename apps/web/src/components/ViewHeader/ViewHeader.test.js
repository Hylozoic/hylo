import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import ViewHeader from './ViewHeader'

function renderViewHeader ({ me = {}, memberships = [] } = {}) {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Me.create({ id: '1', unseenThreadCount: 0, newNotificationCount: 0, ...me })
  memberships.forEach(membership => session.Membership.create({ person: '1', ...membership }))
  return render(<ViewHeader />, { wrapper: AllTheProviders({ orm: session.state }, ['/all']) })
}

describe('ViewHeader nav activity dot', () => {
  it('shows no dot when nothing is unread', () => {
    renderViewHeader({ memberships: [{ id: '10', newPostCount: 0 }] })
    expect(screen.getByTestId('view-header-nav-toggle')).toBeInTheDocument()
    expect(screen.queryByTestId('view-header-activity-dot')).not.toBeInTheDocument()
  })

  it('shows the dot when a group has new posts', () => {
    renderViewHeader({ memberships: [{ id: '10', newPostCount: 3 }] })
    expect(screen.getByRole('img', { name: 'New activity' })).toBeInTheDocument()
  })

  it('shows the dot for unseen message threads', () => {
    renderViewHeader({ me: { unseenThreadCount: 2 } })
    expect(screen.getByTestId('view-header-activity-dot')).toBeInTheDocument()
  })

  it('shows the dot for new notifications', () => {
    renderViewHeader({ me: { newNotificationCount: 1 } })
    expect(screen.getByTestId('view-header-activity-dot')).toBeInTheDocument()
  })
})
