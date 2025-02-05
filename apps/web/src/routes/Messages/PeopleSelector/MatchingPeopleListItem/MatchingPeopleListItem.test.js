import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import MatchingPeopleListItem from './MatchingPeopleListItem'

describe('MatchingPeopleListItem', () => {
  it('renders name and avatar', () => {
    render(<MatchingPeopleListItem name='John Doe' avatarUrl='https://example.com/avatar.jpg' />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByRole('img').getAttribute('style')).toContain('background-image: url(https://example.com/avatar.jpg)')
  })

  it('calls onClick when close button clicked', () => {
    const onClick = jest.fn()
    render(<MatchingPeopleListItem name='John Doe' onClick={onClick} />)

    fireEvent.click(screen.getByRole('button', { name: /ex/i }))
    expect(onClick).toHaveBeenCalled()
  })
})
