import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PeopleListItem from './PeopleListItem'

describe('PeopleListItem', () => {
  const person = {
    active: true,
    id: '1',
    name: 'Wombat',
    avatarUrl: 'https://wombat.life',
    group: 'Marsupials'
  }

  it('renders the person\'s name and group', () => {
    render(<PeopleListItem person={person} />)

    expect(screen.getByText('Wombat')).toBeInTheDocument()
    expect(screen.getByText('Marsupials')).toBeInTheDocument()
  })

  it('renders the person\'s avatar', () => {
    render(<PeopleListItem person={person} />)

    const avatar = screen.getByRole('img')
    expect(avatar.getAttribute('style')).toBe('background-image: url(https://wombat.life);')
  })

  it('applies active class when active prop is true', () => {
    render(<PeopleListItem person={person} active />)

    const listItem = screen.getByRole('listitem')
    expect(listItem).toHaveClass('active')
  })

  it('does not apply active class when active prop is false', () => {
    render(<PeopleListItem person={person} active={false} />)

    const listItem = screen.getByRole('listitem')
    expect(listItem).not.toHaveClass('active')
  })
})
