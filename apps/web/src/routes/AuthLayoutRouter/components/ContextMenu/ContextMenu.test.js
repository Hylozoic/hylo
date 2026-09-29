import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import ContextMenu from './ContextMenu'

jest.mock('driver.js', () => ({ driver: jest.fn() }))
jest.mock('routes/AuthLayoutRouter/components/ContextMenu/MenuRowBackground', () => () => null)

function renderMyHomeMenu (me) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User', settings: {}, ...me })
  return render(<ContextMenu />, { wrapper: AllTheProviders({ orm: ormSession.state }, ['/all/all']) })
}

describe('ContextMenu My Home menu', () => {
  it('greys out empty items instead of hiding them', () => {
    const { container } = renderMyHomeMenu({ hasTracks: false, hasFundingRounds: true, hasTransactions: false, hasSavedSearches: true })

    // Unit tests render translation keys
    const empty = Array.from(container.querySelectorAll('[data-empty="true"]'))
    expect(empty.map(el => el.textContent)).toEqual([
      expect.stringContaining('view-my-tracks'),
      expect.stringContaining('view-my-transactions')
    ])
    empty.forEach(el => {
      expect(el).toHaveAttribute('title', 'Nothing here yet')
      expect(el).toHaveAttribute('href')
    })
    expect(screen.getByText('view-my-funding-rounds').closest('[data-empty]')).toBeNull()
    expect(screen.getByText('view-my-saved-searches').closest('[data-empty]')).toBeNull()
  })

  it('shows every item normally before the fields have loaded', () => {
    const { container } = renderMyHomeMenu({})
    expect(container.querySelectorAll('[data-empty="true"]')).toHaveLength(0)
    expect(screen.getByText('view-my-tracks')).toBeInTheDocument()
  })
})
