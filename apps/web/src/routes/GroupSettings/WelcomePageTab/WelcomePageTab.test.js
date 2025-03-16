import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import WelcomePageTab from './WelcomePageTab'
import { useViewHeader, ViewHeaderContext } from 'contexts/ViewHeaderContext'

describe('WelcomePageTab', () => {
  const mockSetHeaderDetails = jest.fn()
  const defaultGroup = {
    id: '1',
    name: 'Test Group',
    slug: 'test-group',
    accessibility: 1,
    visibility: 1,
    type: 'group',
    purpose: 'Test group purpose',
    location: null,
    locationId: null,
    memberCount: 1,
    postCount: 0,
    feedOrder: 'time',
    welcomePage: '<p>Welcome to our group!</p>',
    settings: {
      showWelcomePage: true,
      askJoinQuestions: false,
      askGroupToGroupJoinQuestions: false,
      hideExtensionData: false
    },
    joinQuestions: [],
    groupToGroupJoinQuestions: [],
    widgets: []
  }

  const emptyGroup = {
    settings: {
      showWelcomePage: false
    }
  }

  const renderWithContext = (ui, { headerValue = { setHeaderDetails: mockSetHeaderDetails } } = {}) => {
    return render(
      <ViewHeaderContext.Provider value={headerValue}>
        {ui}
      </ViewHeaderContext.Provider>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with initial state', () => {
    renderWithContext(<WelcomePageTab group={defaultGroup} />)

    // Check for main elements
    expect(screen.getByText('Welcome Page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    expect(screen.getByText('Current settings up to date')).toBeInTheDocument()
    
    // Check for the switch description
    expect(screen.getByText(/Show this welcome page to new members/)).toBeInTheDocument()
  })

  it('handles toggle of welcome page visibility', () => {
    const mockUpdateGroupSettings = jest.fn()
    renderWithContext(
      <WelcomePageTab 
        group={defaultGroup}
        updateGroupSettings={mockUpdateGroupSettings}
      />
    )

    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Changes not saved')).toBeInTheDocument()
  })

  it('shows loading state when group is empty', () => {
    renderWithContext(<WelcomePageTab group={null} />)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('sets header details on mount', () => {
    renderWithContext(<WelcomePageTab group={defaultGroup} />)
    
    expect(mockSetHeaderDetails).toHaveBeenCalledWith({
      title: 'Group Settings > Welcome Page',
      icon: 'Hands',
      info: ''
    })
  })
})
