import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupsWidget from './GroupsWidget'

const defaultMinProps = {
  routeParams: { context: 'groups', slug: 'group one' },
  items: []
}

function renderComponent (props = {}) {
  return render(
    <GroupsWidget {...{ ...defaultMinProps, ...props }} />
  )
}

describe('GroupsWidget', () => {
  it('renders correctly with minimum props', () => {
    renderComponent()
    expect(screen.getByText('+ Create Group')).toBeInTheDocument()
  })

  it('renders correctly with items', () => {
    const props = {
      items: [
        { id: 1, slug: 'slug1', name: 'group one', avatarUrl: 'https://google.com', description: 'yo', memberCount: 1 },
        { id: 2, slug: 'slug2', name: 'group 2', avatarUrl: 'https://google.com', description: 'oy', memberCount: 10 }
      ]
    }
    renderComponent(props)

    expect(screen.getByText('group one')).toBeInTheDocument()
    expect(screen.getByText('group 2')).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
    expect(screen.getByText(/10 member/)).toBeInTheDocument()
    expect(screen.getByText('yo')).toBeInTheDocument()
    expect(screen.getByText('oy')).toBeInTheDocument()
    expect(screen.getAllByText('View').length).toBe(4) // Two "View" texts per group
  })
})
