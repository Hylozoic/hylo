import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Messages from './Messages'

const mockFetchMessages = jest.fn()
const mockCreateMessage = jest.fn()

const testProps = {
  fetchMessages: mockFetchMessages,
  createMessage: mockCreateMessage,
  match: {
    params: {
      threadId: '1'
    }
  }
}

describe('Messages component', () => {
  it('renders loading state', () => {
    render(
      <Messages {...testProps} />,
      { wrapper: AllTheProviders() }
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders messages title when not loading', async () => {
    render(
      <Messages {...testProps} />,
      { wrapper: AllTheProviders() }
    )

    // Wait for the loading state to finish
    await screen.findByText(/Messages/i)

    expect(screen.getByText(/Messages/i)).toBeInTheDocument()
  })

  it('renders thread list when not loading', async () => {
    render(
      <Messages {...testProps} />,
      { wrapper: AllTheProviders() }
    )

    // Wait for the loading state to finish
    await screen.findByText(/Messages/i)

    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  // Add more tests as needed for specific functionality
})
