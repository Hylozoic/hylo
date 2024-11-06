import React from 'react'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import MessageSection from './MessageSection'

const person1 = { id: '1', name: 'City Bob', avatarUrl: '' }
const person2 = { id: '2', name: 'Country Alice', avatarUrl: '' }

const messages = [
  {
    id: '1',
    creator: person1,
    text: 'hi!',
    createdAt: '2017-05-19T23:24:58Z'
  },
  {
    id: '2',
    creator: person1,
    text: 'how are you?',
    createdAt: '2017-05-19T23:25:07Z'
  },
  {
    id: '3',
    creator: person1,
    text: 'long time no see',
    createdAt: '2017-05-19T23:33:58Z'
  },
  {
    id: '4',
    creator: person2,
    text: 'i am great',
    createdAt: '2017-05-20T00:11:11Z'
  },
  {
    id: '5',
    creator: person2,
    text: 'things are great',
    createdAt: '2017-05-20T00:12:12Z'
  },
  {
    id: '6',
    creator: person2,
    text: 'so great',
    createdAt: '2017-05-20T00:23:12Z'
  },
  {
    id: '7',
    creator: person1,
    text: 'great!',
    createdAt: '2017-05-20T00:23:27Z'
  }
]

let socket

beforeEach(() => {
  socket = {
    on: jest.fn(),
    off: jest.fn()
  }
})

it('fetches more messages when scrolled to top', async () => {
  const fetchMessages = jest.fn()
  render(
    <AllTheProviders>
      <MessageSection
        messages={messages}
        socket={socket}
        fetchMessages={fetchMessages}
        hasMore
      />
    </AllTheProviders>
  )

  const messageSection = screen.getByRole('region')
  fireEvent.scroll(messageSection, { target: { scrollTop: 0, scrollHeight: 1200, offsetHeight: 100 } })

  await waitFor(() => {
    expect(fetchMessages).toHaveBeenCalled()
  })
})

it('shows Loading component when pending is true', () => {
  render(
    <AllTheProviders>
      <MessageSection messages={[]} fetchMessages={() => {}} pending />
    </AllTheProviders>
  )

  expect(screen.getByRole('progressbar')).toBeInTheDocument()
})

it('displays messages when not pending', () => {
  render(
    <AllTheProviders>
      <MessageSection messages={messages} fetchMessages={() => {}} />
    </AllTheProviders>
  )

  expect(screen.getByText('hi!')).toBeInTheDocument()
  expect(screen.getByText('how are you?')).toBeInTheDocument()
})

it('scrolls to bottom when new messages are added', async () => {
  const { rerender } = render(
    <AllTheProviders>
      <MessageSection messages={messages.slice(0, 3)} fetchMessages={() => {}} />
    </AllTheProviders>
  )

  rerender(
    <AllTheProviders>
      <MessageSection messages={messages} fetchMessages={() => {}} />
    </AllTheProviders>
  )

  await waitFor(() => {
    const lastMessage = screen.getByText('great!')
    expect(lastMessage).toBeVisible()
  })
})
