import React from 'react'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import PeopleTyping from './PeopleTyping'

describe('PeopleTyping', () => {
  it('renders nothing when no one is typing', () => {
    render(<PeopleTyping />)
    expect(screen.getByTestId('people-typing')).toHaveTextContent('')
  })

  it('renders a single person typing message', () => {
    const peopleTyping = { user1: { name: 'Alice', timestamp: Date.now() } }
    render(<PeopleTyping />, { wrapper: AllTheProviders({ PeopleTyping: peopleTyping }) })
    expect(screen.getByText('Alice is typing...')).toBeInTheDocument()
  })

  it('renders a multiple people typing message', () => {
    const peopleTyping = {
      user1: { name: 'Alice', timestamp: Date.now() },
      user2: { name: 'Bob', timestamp: Date.now() }
    }
    render(<PeopleTyping />, { wrapper: AllTheProviders({ PeopleTyping: peopleTyping }) })
    expect(screen.getByText('Multiple people are typing...')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<PeopleTyping className='custom-class' />)
    expect(screen.getByTestId('people-typing')).toHaveClass('custom-class')
  })
})
