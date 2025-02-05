import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import MemberPosts from './MemberPosts'
import denormalized from '../MemberProfile.test.json'

describe('MemberPosts', () => {
  const { person } = denormalized.data
  const mockFetchMemberPosts = jest.fn()

  it('renders loading state when loading prop is true', () => {
    render(<MemberPosts fetchMemberPosts={mockFetchMemberPosts} posts={[]} loading />)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders posts when provided', () => {
    render(<MemberPosts fetchMemberPosts={mockFetchMemberPosts} posts={person.posts} />)

    person.posts.forEach(post => {
      expect(screen.getByText(post.title)).toBeInTheDocument()
    })
  })

  it('calls fetchMemberPosts on mount', () => {
    render(<MemberPosts fetchMemberPosts={mockFetchMemberPosts} posts={[]} />)
    expect(mockFetchMemberPosts).toHaveBeenCalledTimes(3)
  })
})
