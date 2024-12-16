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
    <MessageSection
      messages={messages}
      socket={socket}
      fetchMessages={fetchMessages}
      hasMore
    />
  )

  const messageSection = screen.getByTestId('message-section')
   // Mock properties using a loop
   const properties = {
    scrollHeight: 1200,
    offsetHeight: 100,
    scrollTop: 0,
  }
  Object.entries(properties).forEach(([key, value]) => {
    Object.defineProperty(messageSection, key, {
      value,
      writable: true,
    })
  })
  fireEvent.scroll(messageSection, { target: { scrollTop: 0, scrollHeight: 1200, offsetHeight: 100 } })

  await waitFor(() => {
    expect(fetchMessages).toHaveBeenCalled()
  })
})

it('shows Loading component when pending is true', () => {
  render(
    <MessageSection messages={[]} fetchMessages={() => {}} pending />
  )

  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
})

it('displays messages when not pending', () => {
  render(
    <MessageSection messages={messages} fetchMessages={() => {}} />
  )

  expect(screen.getByText('hi!')).toBeInTheDocument()
  expect(screen.getByText('how are you?')).toBeInTheDocument()
})

it('scrolls to bottom when new messages are added', async () => {
  const { rerender } = render(
    <MessageSection messages={messages.slice(0, 3)} fetchMessages={() => {}} />
  )

  rerender(
    <MessageSection messages={messages} fetchMessages={() => {}} />
  )

  await waitFor(() => {
    const lastMessage = screen.getByText('great!')
    expect(lastMessage).toBeVisible()
  })
})
