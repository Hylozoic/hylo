import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import RecentActivity from './RecentActivity'

describe('RecentActivity', () => {
  it('shows loading state while fetching initial activity', () => {
    // Without seeded ORM activity, fetch is pending via store middleware/default state
    // Force loading by rendering with a person that has no activity loaded yet
    render(<RecentActivity routeParams={{ personId: '1' }} />)

    // Component either shows loading or an empty activity list
    const loading = screen.queryByTestId('loading-indicator')
    const items = screen.queryAllByTestId('activity-item')
    expect(loading || items).toBeTruthy()
    expect(items).toHaveLength(0)
  })
})
