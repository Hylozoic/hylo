/* eslint-env jest */
import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostBodyProposal from './PostBodyProposal'

const buildProposal = (overrides = {}) => ({
  id: '1',
  groups: [],
  proposalStatus: 'completed',
  votingMethod: 'single',
  proposalOptions: [],
  proposalVotes: { items: [] },
  isAnonymousVote: false,
  proposalOutcome: 'Adopted',
  startTime: null,
  endTime: null,
  quorum: 0,
  fulfilledAt: null,
  ...overrides
})

describe('PostBodyProposal outcome', () => {
  it('shows the outcome once voting has completed on its own', () => {
    render(<PostBodyProposal post={buildProposal()} currentUser={{ id: '1' }} />)
    expect(screen.getByTestId('proposal-outcome')).toHaveTextContent('Outcome: Adopted')
  })

  it('shows the outcome when the author completed the proposal', () => {
    render(<PostBodyProposal post={buildProposal({ proposalStatus: 'casual', fulfilledAt: '2026-09-01T00:00:00.000Z' })} currentUser={{ id: '1' }} />)
    expect(screen.getByTestId('proposal-outcome')).toHaveTextContent('Outcome: Adopted')
  })

  it('hides the outcome while voting is open', () => {
    render(<PostBodyProposal post={buildProposal({ proposalStatus: 'voting' })} currentUser={{ id: '1' }} />)
    expect(screen.queryByTestId('proposal-outcome')).not.toBeInTheDocument()
  })
})
