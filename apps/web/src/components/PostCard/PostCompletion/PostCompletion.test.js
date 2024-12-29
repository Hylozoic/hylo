import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostCompletion from './PostCompletion'

describe('PostCompletion', () => {
  it('renders correctly if fulfilled for a project', () => {
    render(<PostCompletion isFulfilled type='project' />)

    expect(screen.getByText('Is this project still active?')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
  })

  it('renders correctly if not fulfilled for a resource', () => {
    render(<PostCompletion isFulfilled={false} type='resource' />)

    expect(screen.getByText('Is this resource still available?')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  // Add more tests for different types and states as needed
})
