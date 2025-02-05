import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PeopleList from './PeopleList'

describe('PeopleList', () => {
  const people = [
    {
      id: '1',
      name: 'Wombat',
      avatarUrl: 'https://flargle.com',
      group: 'Wombats'
    },
    {
      id: '2',
      name: 'Aardvark',
      avatarUrl: 'https://argle.com',
      group: 'Aardvarks'
    },
    {
      id: '3',
      name: 'Ocelot',
      avatarUrl: 'https://wargle.com',
      group: 'Ocelots'
    }
  ]

  it('renders a list of people', () => {
    render(
      <PeopleList people={people} onMouseOver={() => {}} />
    )

    expect(screen.getByText('Wombat')).toBeInTheDocument()
    expect(screen.getByText('Aardvark')).toBeInTheDocument()
    expect(screen.getByText('Ocelot')).toBeInTheDocument()
  })

  it('renders nothing when people array is empty', () => {
    render(
      <PeopleList people={[]} onMouseOver={() => {}} />
    )

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('calls onMouseOver when hovering over a person', () => {
    const onMouseOver = jest.fn()
    render(
      <PeopleList people={people} onMouseOver={onMouseOver} />
    )

    screen.getByText('Wombat').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(onMouseOver).toHaveBeenCalledWith(people[0])
  })

  it('highlights the current match', () => {
    render(
      <PeopleList
        people={people}
        onMouseOver={() => {}}
        currentMatch={people[1]}
        onClick={() => {}}
      />
    )

    const activeItem = screen.getByText('Aardvark').closest('li')
    expect(activeItem).toHaveClass('active') // Assuming the active class is applied to the li element
  })
})
