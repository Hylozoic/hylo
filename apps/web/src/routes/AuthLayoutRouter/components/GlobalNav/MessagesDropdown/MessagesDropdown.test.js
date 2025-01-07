import React from 'react'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import MessagesDropdown from './MessagesDropdown'
import MessagesDropdownItem from './MessagesDropdownItem'
import { lastMessageCreator } from './util'
import orm from 'store/models'

const mockT = jest.fn((str, params) => {
  if (!params) return str
  let result = str
  Object.entries(params).forEach(([key, value]) => {
    result = result.replace(`{{${key}}}`, value)
  })
  return result
})

const u1 = { id: '1', name: 'Charles Darwin', avatarUrl: 'foo.png' }
const u2 = { id: '2', name: 'Marie Curie', avatarUrl: 'bar.png' }
const u3 = { id: '3', name: 'Arthur Fonzarelli', avatarUrl: 'baz.png' }

const messages = [
  { text: 'hi', creator: u2.id, messageThread: '1' },
  { text: 'there', creator: u3.id, messageThread: '2' }
]

const threads = [
  {
    id: '1',
    participants: [u1, u2, u3].map(u => u.id),
    updatedAt: '2017-05-07T03:24:00',
    messages: { items: [messages[0]] }
  },
  {
    id: '2',
    participants: [u1, u2, u3].map(u => u.id),
    updatedAt: '1995-12-17T03:23:00',
    messages: { items: [messages[1]] }
  }
]

const session = orm.mutableSession(orm.getEmptyState())
const { MessageThread, Message, Person } = session

const users = [u1, u2, u3]
users.map(u => Person.create(u))

threads.map(t => MessageThread.create(t))

messages.map(m => Message.create(m))

const reduxState = { orm: session.state }

const testProviders = () => {
  return AllTheProviders(reduxState)
}

describe('MessagesDropdown', () => {

  it('renders correctly with an empty list', async () => {

    mockGraphqlServer.use(
      graphql.query('MessageThreadsQuery', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              messageThreads: {
                items: []
              }
            }
          }
        })
      })
    )
    render(
      <MessagesDropdown
        renderToggleChildren={() => <span>click me</span>}
        currentUser={u1}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('click me')).toBeInTheDocument()
      expect(screen.getByText("You don't have any messages yet")).toBeInTheDocument()
    })
  })

  it('renders correctly with a list of threads', async () => {
    mockGraphqlServer.use(
      graphql.query('MessageThreadsQuery', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              messageThreads: { items: threads }
            }
          }
        })
      })
    )
    render(
      <MessagesDropdown
        renderToggleChildren={() => <span>click me</span>}
        currentUser={u1}
      />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('click me')).toBeInTheDocument()
      expect(screen.getAllByText('Marie Curie and Arthur Fonzarelli')).toHaveLength(2)
      expect(screen.getByText('Marie Curie: hi')).toBeInTheDocument()
    })
  })
})

describe('MessagesDropdownItem', () => {
  it('renders correctly with an empty thread', async () => {
    const thread = { messages: { items: [] } }
    render(<MessagesDropdownItem thread={thread} t={mockT} />)

    await waitFor(() => {
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })
  })

  it('renders correctly with no other participants', async () => {
    const currentUser = { id: 1, name: 'Ra', avatarUrl: 'ra.png' }
    const thread = {
      participants: [currentUser],
      messages: { items: [{ creator: currentUser.id }] }
    }
    render(<MessagesDropdownItem thread={thread} currentUser={currentUser} t={mockT} />)

    await waitFor(() => {
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    })
  })

  it('renders correctly with a message', async () => {
    const mockNavigate = jest.fn()
    const goToThread = i => mockNavigate(i)
    render(
      <MessagesDropdownItem
        thread={session.MessageThread.withId(threads[0].id)}
        currentUser={session.Person.withId(u1.id)}
        onClick={() => goToThread(threads[0].id)}
        t={mockT}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Marie Curie and Arthur Fonzarelli')).toBeInTheDocument()
      expect(screen.getByText('Marie Curie: hi')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('listitem'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(threads[0].id)
    })
  })
})

describe('lastMessageCreator', () => {
  it('handles when the current user created the message', () => {
    const formattedName = 'You: '
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 1 }
    }
    expect(lastMessageCreator(message, currentUser, [], mockT)).toBe(formattedName)
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
    expect(lastMessageCreator(message, currentUser, participants, mockT)).toBe(formattedName)
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
    expect(lastMessageCreator(message, currentUser, participants, mockT)).toBe('')
  })
})
