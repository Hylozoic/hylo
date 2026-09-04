import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostCompletion from './PostCompletion'

describe('PostCompletion', () => {
  it('renders correctly if fulfilled for a project', () => {
    render(<PostCompletion isFulfilled type='project' />)

    expect(screen.getByText('Is this project still active?')).toBeInTheDocument()
    expect(screen.getByText('YES')).toBeInTheDocument()
    expect(screen.getByText('NO')).toBeInTheDocument()
  })

  it('renders correctly if not fulfilled for a resource', () => {
    render(<PostCompletion isFulfilled={false} type='resource' />)

    expect(screen.getByText('Is this resource still available?')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('renders moderator styling when isModerator is true', () => {
    render(<PostCompletion isFulfilled={false} type='request' isModerator />)

    expect(screen.getByText('Moderator')).toBeInTheDocument()
    expect(screen.getByText('Is this request still needed?')).toBeInTheDocument()
  })
})
