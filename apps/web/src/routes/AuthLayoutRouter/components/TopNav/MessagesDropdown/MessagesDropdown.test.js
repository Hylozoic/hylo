import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import MessagesDropdown, { MessagesDropdownItem, lastMessageCreator } from './MessagesDropdown'
import orm from 'store/models'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

const mockStore = configureStore([])

const session = orm.mutableSession(orm.getEmptyState())
const { MessageThread, Message, Person } = session

const u1 = { id: '1', name: 'Charles Darwin', avatarUrl: 'foo.png' }
const u2 = { id: '2', name: 'Marie Curie', avatarUrl: 'bar.png' }
const u3 = { id: '3', name: 'Arthur Fonzarelli', avatarUrl: 'baz.png' }

;[u1, u2, u3].forEach(u => Person.create(u))

const threads = [
  {
    id: 2,
    participants: [u1, u2, u3].map(u => u.id),
    updatedAt: '2017-05-07T03:24:00'
  },
  {
    id: 1,
    participants: [u1, u2, u3].map(u => u.id),
    updatedAt: '1995-12-17T03:23:00'
  }
].map(t => MessageThread.create(t))

;[
  { text: 'hi', creator: u2.id, messageThread: threads[0].id },
  { text: 'there', creator: u3.id, messageThread: threads[1].id }
].map(m => Message.create(m))

describe('MessagesDropdown', () => {
  it('renders correctly with an empty list', () => {
    const store = mockStore({
      pending: {},
      orm: orm.getEmptyState()
    })

    render(
      <Provider store={store}>
        <MessagesDropdown
          fetchThreads={jest.fn()}
          renderToggleChildren={() => <span>click me</span>}
          threads={[]}
          currentUser={u1}
        />
      </Provider>
    )

    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.getByText("You don't have any messages yet")).toBeInTheDocument()
  })

  it('renders correctly with a list of threads', () => {
    const store = mockStore({
      pending: {},
      orm: session.state
    })

    render(
      <Provider store={store}>
        <MessagesDropdown
          fetchThreads={jest.fn()}
          renderToggleChildren={() => <span>click me</span>}
          threads={threads}
          currentUser={u1}
        />
      </Provider>
    )

    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.getByText('Marie Curie and Arthur Fonzarelli')).toBeInTheDocument()
    expect(screen.getByText('Marie Curie: hi')).toBeInTheDocument()
  })
})

describe('MessagesDropdownItem', () => {
  it('renders correctly with an empty thread', () => {
    const thread = new MessageThread({})
    render(<MessagesDropdownItem thread={thread} />)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('renders correctly with no other participants', () => {
    const currentUser = { id: 1, name: 'Ra', avatarUrl: 'ra.png' }
    const thread = new MessageThread({
      participants: [currentUser]
    })
    render(<MessagesDropdownItem thread={thread} currentUser={currentUser} />)
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('renders correctly with a message', () => {
    const mockNavigate = jest.fn()
    const goToThread = i => mockNavigate(i)
    render(
      <MessagesDropdownItem
        thread={threads[0]}
        currentUser={u1}
        onClick={() => goToThread(threads[0].id)}
      />
    )

    expect(screen.getByText('Marie Curie and Arthur Fonzarelli')).toBeInTheDocument()
    expect(screen.getByText('Marie Curie: hi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('listitem'))
    expect(mockNavigate).toHaveBeenCalledWith(threads[0].id)
  })
})

describe('lastMessageCreator', () => {
  it('handles when the current user created the message', () => {
    const formattedName = 'You: '
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 1 }
    }
    expect(lastMessageCreator(message, currentUser, [])).toBe(formattedName)
  })
  it('handles when a different user created the message', () => {
    const name = 'name'
    const formattedName = 'name: '
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 2 }
    }
    const participants = [
      { id: 2, name },
      { id: 3, name: 'other' },
      { id: 4, name: 'another' }
    ]
    expect(lastMessageCreator(message, currentUser, participants)).toBe(formattedName)
  })
  it('handles when there are 2 participants and a different user created the message', () => {
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 2 }
    }
    const participants = [
      { id: 2, name: 'name1' },
      { id: 2, name: 'name2' }
    ]
    expect(lastMessageCreator(message, currentUser, participants)).toBe('')
  })
})
