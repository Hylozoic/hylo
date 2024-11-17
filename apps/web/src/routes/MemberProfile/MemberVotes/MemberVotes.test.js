import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import MemberVotes from './MemberVotes'
import denormalized from '../MemberProfile.test.json'

describe('MemberVotes', () => { // TODO REACTIONS: switch this to reactions
  const { person } = denormalized.data

  it('renders post cards for each vote', () => {
    render(
      <MemberVotes fetchMemberVotes={jest.fn()} posts={person.votes} />
    )

    person.votes.forEach(vote => {
      expect(screen.getByText(vote.title)).toBeInTheDocument()
    })
  })

  it('displays loading state when loading prop is true', () => {
    render(
      <MemberVotes fetchMemberVotes={jest.fn()} posts={[]} loading />
    )

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })
})
