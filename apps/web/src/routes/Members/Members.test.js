import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Members, { twoByTwo } from './Members'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'

const mockStore = configureStore([])

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ groupSlug: 'test-group' }),
  useLocation: () => ({ search: '' })
}))

describe('Members component', () => {
  it('renders members and total count', () => {
    const store = mockStore({
      pending: {},
      groups: {
        'test-group': { id: 1, name: 'Test Group', memberCount: 3 }
      },
      members: {
        'test-group': [
          { id: '1', name: 'You' },
          { id: '2', name: 'Me' },
          { id: '3', name: 'Everyone' }
        ]
      }
    })

    render(
      <Provider store={store}>
        <Members />
      </Provider>
    )

    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('3 Total Members')).toBeInTheDocument()
    expect(screen.getAllByTestId('member-card')).toHaveLength(3)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Me')).toBeInTheDocument()
    expect(screen.getByText('Everyone')).toBeInTheDocument()
  })

  it('renders invite button when user has permission', () => {
    const store = mockStore({
      pending: {},
      groups: {
        'test-group': { id: 1, name: 'Test Group', memberCount: 1 }
      },
      members: {
        'test-group': [{ id: '1', name: 'You' }]
      },
      responsibilities: {
        1: [{ title: 'Add Members' }]
      }
    })

    render(
      <Provider store={store}>
        <Members />
      </Provider>
    )

    expect(screen.getByText('Invite People')).toBeInTheDocument()
  })
})

describe('twoByTwo', () => {
  it('groups items into pairs', () => {
    expect(twoByTwo([1, 2, 3, 4, 5, 6, 7])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7]
    ])
  })
})
