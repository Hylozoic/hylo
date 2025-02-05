import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import MemberSelector, { Suggestion } from './MemberSelector'

describe('MemberSelector', () => {
  const defaultMinProps = {
    setMembers: jest.fn(),
    members: [],
    setAutocomplete: jest.fn(),
    fetchPeople: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    onChange: jest.fn(),
    memberMatches: []
  }

  function renderComponent (props = {}) {
    return render(<MemberSelector {...{ ...defaultMinProps, ...props }} />)
  }

  it('renders correctly (with min props)', () => {
    renderComponent()
    expect(screen.getByPlaceholderText('Type persons name...')).toBeInTheDocument()
  })

  it('calls setMembers on mount', () => {
    renderComponent()
    expect(defaultMinProps.setMembers).toHaveBeenCalled()
  })

  it('calls onChange when members change', async () => {
    const { rerender } = renderComponent()
    rerender(<MemberSelector {...defaultMinProps} members={[{ id: 1 }]} />)
    await waitFor(() => expect(defaultMinProps.onChange).toHaveBeenCalledWith([{ id: 1 }]))
  })

  it('calls setMembers when initialMembers change', async () => {
    const { rerender } = renderComponent({ initialMembers: [{ id: 1 }] })
    defaultMinProps.setMembers.mockClear()
    rerender(<MemberSelector {...defaultMinProps} initialMembers={[{ id: 1 }, { id: 2 }]} />)
    await waitFor(() => expect(defaultMinProps.setMembers).toHaveBeenCalled())
  })

  it('handles input change', async () => {
    renderComponent()
    fireEvent.change(screen.getByPlaceholderText('Type persons name...'), { target: { value: 'John' } })
    await waitFor(() => {
      expect(defaultMinProps.setAutocomplete).toHaveBeenCalledWith('John')
      expect(defaultMinProps.fetchPeople).toHaveBeenCalledWith({ autocomplete: 'John', groupIds: null })
    })
  })

  // TODO: Fix this test
  it.skip('handles member addition', async () => {
    renderComponent({ memberMatches: [{ id: 1, name: 'John Doe' }] })
    fireEvent.change(screen.getByPlaceholderText('Type persons name...'), { target: { value: 'John' } })
    await waitFor(() => {
      fireEvent.click(screen.getByText('John Doe'))
      expect(defaultMinProps.addMember).toHaveBeenCalledWith({ id: 1, name: 'John Doe' })
    })
  })

  it('handles member deletion', async () => {
    renderComponent({ members: [{ id: 1, name: 'John Doe' }] })
    fireEvent.click(screen.getByText('×'))
    await waitFor(() => {
      expect(defaultMinProps.removeMember).toHaveBeenCalledWith({ id: 1, name: 'John Doe' })
    })
  })
})

describe('Suggestion', () => {
  const defaultMinProps = {
    item: { id: 1, name: 'John Doe', avatarUrl: 'face.png' },
    handleChoice: jest.fn()
  }

  function renderComponent (props = {}) {
    return render(<Suggestion {...{ ...defaultMinProps, ...props }} />)
  }

  it('renders correctly', () => {
    renderComponent()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('calls handleChoice when clicked', () => {
    renderComponent()
    fireEvent.click(screen.getByText('John Doe'))
    expect(defaultMinProps.handleChoice).toHaveBeenCalledWith(defaultMinProps.item, expect.any(Object))
  })
})
