import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import EventInviteDialog, { InviteeRow, Search } from './EventInviteDialog'

describe('EventInviteDialog', () => {
  it('renders correctly', () => {
    const props = {
      onClose: jest.fn(),
      eventInvitations: [{ id: 1 }, { id: 2 }, { id: 3 }],
      people: [{ id: 1, name: 'Alice' }, { id: 4, name: 'Bob' }, { id: 5, name: 'Charlie' }],
      forGroups: [],
      fetchPeople: jest.fn(),
      eventId: '123',
      invitePeopleToEvent: jest.fn(),
      pending: false
    }
    render(<EventInviteDialog {...props} />)

    expect(screen.getByText('Invite')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search members')).toBeInTheDocument()
    expect(screen.getByText('Already Invited')).toBeInTheDocument()
    expect(screen.getByText('Select people to invite')).toBeInTheDocument()
  })
})

describe('InviteeRow', () => {
  it('renders correctly', () => {
    const props = {
      person: { id: 1, name: 'John', avatarUrl: 'john.png', response: 'not needed' },
      selected: true,
      onClick: jest.fn()
    }
    render(<InviteeRow {...props} />)

    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByTestId('icon-Checkmark')).toBeInTheDocument()
  })

  it('renders correctly with showResponse', () => {
    const props = {
      person: { id: 1, name: 'Jane', avatarUrl: 'jane.png', response: 'interested' },
      selected: true,
      onClick: jest.fn(),
      showResponse: true
    }
    render(<InviteeRow {...props} />)

    expect(screen.getByText('Jane')).toBeInTheDocument()
    expect(screen.getByText('Interested')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-Checkmark')).not.toBeInTheDocument()
  })
})

describe('Search', () => {
  it('renders correctly and handles input', () => {
    const onChange = jest.fn()
    render(<Search onChange={onChange} />)

    const input = screen.getByPlaceholderText('Search members')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'test' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
