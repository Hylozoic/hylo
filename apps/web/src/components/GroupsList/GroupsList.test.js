import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { DEFAULT_AVATAR } from 'store/models/Group'
import GroupsList, { GroupRow, GroupCell } from './GroupsList'

describe('GroupsList', () => {
  it('renders correct number of groups', () => {
    const props = {
      groups: [
        { id: 1, name: 'One', slug: 'one' },
        { id: 2, name: 'Two', slug: 'two' },
        { id: 3, name: 'Three', slug: 'three' }
      ]
    }

    render(<GroupsList {...props} />)
    const groupLinks = screen.getAllByRole('link')
    expect(groupLinks).toHaveLength(3)
  })

  it('renders groups in rows of two', () => {
    const props = {
      groups: [
        { id: 1, name: 'One', slug: 'one' },
        { id: 2, name: 'Two', slug: 'two' },
        { id: 3, name: 'Three', slug: 'three' }
      ]
    }

    const { container } = render(<GroupsList {...props} />)
    const rows = container.querySelectorAll('.groupRow')
    expect(rows).toHaveLength(2)
  })
})

describe('GroupRow', () => {
  it('renders correct number of groups in a row', () => {
    const props = {
      groups: [
        { id: 1, name: 'One', slug: 'one' },
        { id: 2, name: 'Two', slug: 'two' }
      ]
    }

    render(<GroupRow {...props} />)
    const groupLinks = screen.getAllByRole('link')
    expect(groupLinks).toHaveLength(2)
  })
})

describe('GroupCell', () => {
  it('renders group name and link', () => {
    const props = {
      group: {
        id: 1,
        name: 'Test Group',
        slug: 'test-group',
        avatarUrl: 'test.png'
      }
    }

    render(
      <GroupCell {...props} />
    )

    const groupLink = screen.getByRole('link', { name: 'Test Group' })
    expect(groupLink).toBeInTheDocument()
    expect(groupLink).toHaveAttribute('href', '/groups/test-group')
  })

  it('renders default avatar when avatarUrl is not provided', () => {
    const props = {
      group: {
        id: 1,
        name: 'Test Group',
        slug: 'test-group'
      }
    }

    render(
      <GroupCell {...props} />
    )

    const avatar = screen.getByTestId('group-avatar')
    expect(avatar).toHaveStyle({ backgroundImage: `url(${DEFAULT_AVATAR})` })
  })
})
