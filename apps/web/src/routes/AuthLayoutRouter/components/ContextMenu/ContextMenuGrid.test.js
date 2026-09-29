import React from 'react'
import en from '../../../../../public/locales/en.json'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { TOUR_LAYOUT_GRID } from 'tours/layouts'
import { CARD_SIZE_CLASS } from './viewCardTheme'
import ContextMenuGrid from './ContextMenuGrid'

jest.mock('driver.js', () => ({ driver: jest.fn() }))

function providersWithMe (me) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User', settings: {}, ...me })
  return AllTheProviders({ orm: ormSession.state })
}

describe('ContextMenuGrid My Home menu', () => {
  it('greys out empty items instead of hiding them', () => {
    const { container } = render(<ContextMenuGrid context='my' />, {
      wrapper: providersWithMe({ hasTracks: false, hasFundingRounds: true, hasTransactions: false, hasSavedSearches: true })
    })

    // Unit tests render translation keys
    const empty = Array.from(container.querySelectorAll('[data-empty="true"]')).map(el => el.textContent)
    expect(empty).toEqual(['view-my-tracks', 'view-my-transactions'])
    expect(screen.getByText('view-my-funding-rounds')).toBeInTheDocument()
    expect(screen.getByText('view-my-saved-searches')).toBeInTheDocument()
  })

  it('gives a greyed-out card the usual card footprint on phones', () => {
    const { container } = render(<ContextMenuGrid context='my' />, {
      wrapper: providersWithMe({ hasTracks: false })
    })

    const wrapper = container.querySelector('[data-empty="true"]')
    // The wrapper takes the card size and the card fills it; a card sized as a
    // percentage of a wrapper that sizes itself to the card shrinks on phones
    CARD_SIZE_CLASS.split(' ').forEach(cls => expect(wrapper).toHaveClass(cls))
    const card = wrapper.querySelector('[role="button"]')
    expect(card).toHaveClass('w-full', 'h-full', 'aspect-auto')
    expect(card).not.toHaveClass('w-[calc(50%-0.375rem)]')
  })

  it('names the cross-group feed All My Groups', () => {
    render(<ContextMenuGrid context='my' />, { wrapper: providersWithMe({}) })
    expect(screen.getByText('view-my-groups-all')).toBeInTheDocument()
    expect(en['view-my-groups-all']).toBe('All My Groups')
  })

  it('marks itself as the card-menu tour layout', () => {
    const { container } = render(<ContextMenuGrid context='my' />, { wrapper: providersWithMe({}) })
    expect(container.querySelector('.ContextMenuGrid')).toHaveAttribute('data-tour-layout', TOUR_LAYOUT_GRID)
  })
})
