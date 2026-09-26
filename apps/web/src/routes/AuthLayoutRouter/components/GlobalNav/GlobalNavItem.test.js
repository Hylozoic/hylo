import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import GlobalNavItem from './GlobalNavItem'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: jest.fn().mockReturnValue({}),
  useLocation: jest.fn().mockReturnValue({ pathname: '', search: '' })
}))

beforeEach(() => {
  mockNavigate.mockClear()
})

describe('GlobalNavItem keyboard access', () => {
  it('is a named, focusable button that Enter and Space activate', () => {
    render(<GlobalNavItem url='/groups/garden' tooltip='Garden Club' />)

    const tile = screen.getByRole('button', { name: 'Garden Club' })
    expect(tile).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(tile, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/groups/garden')

    fireEvent.keyDown(tile, { key: ' ' })
    expect(mockNavigate).toHaveBeenCalledTimes(2)
  })

  it('ignores other keys', () => {
    render(<GlobalNavItem url='/groups/garden' tooltip='Garden Club' />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Garden Club' }), { key: 'a' })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('leaves the tab stop to the sortable wrapper when pinned', () => {
    const { container } = render(<GlobalNavItem url='/groups/garden' tooltip='Garden Club' isPinned />)

    expect(screen.queryByRole('button', { name: 'Garden Club' })).not.toBeInTheDocument()
    expect(container.querySelector('.GlobalNavItemTile')).not.toHaveAttribute('tabindex')
  })

  it('is not a separate control when it has no destination of its own', () => {
    const { container } = render(<GlobalNavItem tooltip='Activity' />)

    expect(screen.queryByRole('button', { name: 'Activity' })).not.toBeInTheDocument()
    expect(container.querySelector('.GlobalNavItemTile')).not.toHaveAttribute('tabindex')
  })
})
