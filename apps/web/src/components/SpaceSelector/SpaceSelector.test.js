import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import SpaceSelector from './SpaceSelector'

const spaces = [
  { id: '1', name: 'Permaculture Track', status: 'published', track: { id: 't1' } },
  { id: '2', name: 'Spring Round', fundingRound: { id: 'fr1' } },
  { id: '3', name: 'Working Group' }
]

describe('SpaceSelector', () => {
  it('renders selected spaces and grouped suggestions', () => {
    const onSelectSpace = jest.fn()
    render(
      <SpaceSelector
        spaces={spaces}
        selectedSpaces={[spaces[0]]}
        onSelectSpace={onSelectSpace}
      />
    )

    expect(screen.getByText('Permaculture Track')).toBeInTheDocument()

    fireEvent.focus(screen.getByPlaceholderText('Search for spaces'))
    expect(screen.getByText('Funding Rounds')).toBeInTheDocument()
    expect(screen.getByText('Spring Round')).toBeInTheDocument()
    expect(screen.queryByText('Other Spaces')).not.toBeInTheDocument()
    expect(screen.getByText('Working Group')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Spring Round'))
    expect(onSelectSpace).toHaveBeenCalledWith(expect.objectContaining({
      id: '2',
      name: 'Spring Round'
    }))
  })

  it('filters suggestions by search text', () => {
    render(
      <SpaceSelector
        spaces={spaces}
        selectedSpaces={[]}
      />
    )

    const input = screen.getByPlaceholderText('Search for spaces')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'working' } })

    expect(screen.getByText('Working Group')).toBeInTheDocument()
    expect(screen.queryByText('Spring Round')).not.toBeInTheDocument()
    expect(screen.queryByText('Permaculture Track')).not.toBeInTheDocument()
  })

  it('offers create-a-space when onCreateSpace is provided', () => {
    const onCreateSpace = jest.fn()
    render(
      <SpaceSelector
        spaces={spaces}
        selectedSpaces={[]}
        onCreateSpace={onCreateSpace}
      />
    )

    fireEvent.focus(screen.getByPlaceholderText('Search for spaces'))
    fireEvent.click(screen.getByText('Create a new space'))
    expect(onCreateSpace).toHaveBeenCalled()
  })
})
