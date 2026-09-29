import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import AppearanceTab from './AppearanceTab'

function providersWithMe () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User', settings: { globalNavStyle: 'sidebar' } })
  return AllTheProviders({ orm: ormSession.state })
}

describe('AppearanceTab', () => {
  it('shows color mode and theme up front', () => {
    render(<AppearanceTab />, { wrapper: providersWithMe() })
    expect(screen.getByText('Color Mode')).toBeInTheDocument()
    expect(screen.getByText('Color Theme')).toBeInTheDocument()
  })

  it('keeps the navigation preferences in a collapsed Advanced section', () => {
    render(<AppearanceTab />, { wrapper: providersWithMe() })
    const toggle = screen.getByRole('button', { name: 'Advanced' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Global Navigation')).not.toBeInTheDocument()
    expect(screen.queryByText('Group Nav Stacking')).not.toBeInTheDocument()
    expect(screen.queryByText('Group Menu Style')).not.toBeInTheDocument()
  })

  it('reveals the navigation preferences when Advanced is opened', () => {
    render(<AppearanceTab />, { wrapper: providersWithMe() })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Global Navigation')).toBeInTheDocument()
    expect(screen.getByText('Group Nav Stacking')).toBeInTheDocument()
    expect(screen.getByText('Group Menu Style')).toBeInTheDocument()
  })
})
