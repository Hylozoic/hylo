import React from 'react'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import ThreadList from './ThreadList'
import ThreadListItem from './ThreadListItem'

jest.mock('store/actions/fetchThreads', () => {
  return function fetchThreads () {
    return {
      type: 'FETCH_THREADS',
      payload: Promise.resolve({
        data: { me: { messageThreads: { items: [] } } }
      })
    }
  }
})

function emptyProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'Test User' })
  return AllTheProviders({ orm: ormSession.state })
}

describe('ThreadList', () => {
  it('renders search input and compose link', () => {
    const { container } = render(<ThreadList />, { wrapper: emptyProviders() })
    expect(screen.getByPlaceholderText('Search messages...')).toBeInTheDocument()
    expect(container.querySelector('a[href="/messages/new"]')).toBeInTheDocument()
    expect(screen.getByText('Inbox')).toBeInTheDocument()
    expect(screen.getByText('Muted')).toBeInTheDocument()
  })
})

describe('ThreadListItem', () => {
  let MessageThread, Person
  const currentUser = { id: 2, name: 'Ra', avatarUrl: 'ra.png' }

  beforeEach(() => {
    const session = orm.session(orm.getEmptyState())
    MessageThread = session.MessageThread
    Person = session.Person
  })

  it('renders thread with multiple participants', () => {
    const props = {
      currentUser,
      thread: MessageThread.create({
        participants: [
          { id: 1, name: 'Jo', avatarUrl: 'jo.png' },
          currentUser,
          { id: 3, name: 'La', avatarUrl: 'la.png' }
        ].map(p => Person.create(p))
      })
    }

    render(<ThreadListItem {...props} />)
    expect(screen.getByText('Jo and La')).toBeInTheDocument()
  })

  it('renders thread with 2 participants', () => {
    const props = {
      currentUser,
      thread: MessageThread.create({
        participants: [
          { id: 1, name: 'Jo', avatarUrl: 'jo.png' },
          currentUser
        ].map(p => Person.create(p))
      })
    }

    render(<ThreadListItem {...props} />)
    expect(screen.getByText('Jo')).toBeInTheDocument()
  })

  it('renders thread with just the current user', () => {
    const props = {
      currentUser,
      thread: MessageThread.create({
        participants: [
          currentUser
        ].map(p => Person.create(p))
      })
    }

    render(<ThreadListItem {...props} />)
    expect(screen.getByText('You')).toBeInTheDocument()
  })
})
