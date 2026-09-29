import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import { OpportunityToCollaborate } from './OpportunitiesToCollaborateWidget'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

jest.mock('store/selectors/getMe', () => () => ({ id: '99', name: 'Viewer' }))

describe('OpportunityToCollaborate', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('messages every steward the group lists, Hosts included', () => {
    const group = {
      id: '1',
      name: 'Seed Library',
      stewards: [
        { id: '10', name: 'Ada Administrator' },
        { id: '11', name: 'Mo Moderator' },
        { id: '12', name: 'Hana Host' }
      ]
    }

    render(<OpportunityToCollaborate group={group} opportunity='research' />)
    fireEvent.click(screen.getByTestId('message-stewards'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const url = mockNavigate.mock.calls[0][0]
    expect(url).toContain('participants=10,11,12')
  })

  it('still opens a message when the stewards have not loaded', () => {
    render(<OpportunityToCollaborate group={{ id: '1', name: 'Seed Library' }} opportunity='research' />)
    fireEvent.click(screen.getByTestId('message-stewards'))
    expect(mockNavigate.mock.calls[0][0]).toContain('participants=&')
  })
})
