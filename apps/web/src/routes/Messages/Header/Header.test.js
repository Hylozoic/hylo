import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Header from './Header'

describe('Header', () => {
  it('should render participant names', () => {
    const participants = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }, { id: 3, name: 'Three' }]
    const props = {
      currentUser: {
        id: 1,
        name: 'One'
      },
      messageThread: {
        participants
      }
    }
    render(<Header {...props} />)
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Three')).toBeInTheDocument()
  })

  it('should render "You" when current user is the only participant', () => {
    const props = {
      currentUser: { id: 1, name: 'One' },
      messageThread: {
        participants: [{ id: 1, name: 'One' }]
      }
    }
    render(<Header {...props} />)
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('should not render when pending', () => {
    const props = {
      currentUser: { id: 1, name: 'One' },
      messageThread: {
        participants: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }]
      },
      pending: true
    }
    const { container } = render(<Header {...props} />)
    expect(container.innerHTML).toBe('')
  })
})
