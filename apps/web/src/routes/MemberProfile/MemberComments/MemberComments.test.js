import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import MemberComments from './MemberComments'
import denormalized from '../MemberProfile.test.json'

describe('MemberComments', () => {
  const { person } = denormalized.data

  it('renders comments when provided', () => {
    render(
      <MemberComments fetchMemberComments={jest.fn()} comments={person.comments} />
    )

    // Assuming each comment has a unique text content, we can check for the presence of one
    expect(screen.getByText(person.comments[0].text)).toBeInTheDocument()

    // Check if the correct number of CommentCard components are rendered
    expect(screen.getAllByTestId('comment-card')).toHaveLength(person.comments.length)
  })

  it('displays loading state when loading prop is true', () => {
    render(
      <MemberComments fetchMemberComments={jest.fn()} comments={[]} loading />
    )

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('calls fetchMemberComments on mount', () => {
    const fetchMemberComments = jest.fn()
    render(
      <MemberComments fetchMemberComments={fetchMemberComments} comments={[]} />
    )

    expect(fetchMemberComments).toHaveBeenCalledTimes(1)
  })
})
