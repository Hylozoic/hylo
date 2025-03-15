import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import ThreadList from './ThreadList'
import ThreadListItem from './ThreadListItem'
import orm from 'store/models'

describe('ThreadList', () => {
  it('renders empty state correctly', () => {
    render(
      <ThreadList threads={[]} fetchThreads={jest.fn()} match={{ params: {} }} />
    )
    expect(screen.getByText('You have no active messages')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(
      <ThreadList threads={[]} fetchThreads={jest.fn()} match={{ params: {} }} />
    )
    expect(screen.getByPlaceholderText('Search for people...')).toBeInTheDocument()
  })

  it('renders new message button', () => {
    render(
      <ThreadList threads={[]} fetchThreads={jest.fn()} match={{ params: {} }} />
    )
    expect(screen.getByText('New')).toBeInTheDocument()
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
