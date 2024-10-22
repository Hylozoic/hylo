import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'

import SimpleTabBar from './SimpleTabBar'

const tabNames = ['Wombats', 'Aardvarks', 'Ocelots']

it('renders all tab names', () => {
  render(<SimpleTabBar tabNames={tabNames} />)

  tabNames.forEach(name => {
    expect(screen.getByText(name)).toBeInTheDocument()
  })
})

it('renders the correct number of tabs', () => {
  render(<SimpleTabBar tabNames={tabNames} />)

  const tabs = screen.getAllByRole('listitem')
  expect(tabs).toHaveLength(3)
})

it('calls selectTab with the correct value when tab is clicked', async () => {
  const selectTab = jest.fn()
  render(<SimpleTabBar tabNames={tabNames} selectTab={selectTab} />)

  const lastTab = screen.getByText('Ocelots')
  await userEvent.click(lastTab)

  expect(selectTab).toHaveBeenCalledWith('Ocelots')
})

it('applies active class to the current tab', () => {
  render(<SimpleTabBar currentTab='Wombats' tabNames={tabNames} />)

  const activeTab = screen.getByText('Wombats')
  expect(activeTab).toHaveClass('tabActive')
})
