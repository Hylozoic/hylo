import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import PostGroups from './PostGroups'

describe('PostGroups', () => {
  const defaultProps = {
    groups: [
      { id: 1, name: 'One', slug: 'one' },
      { id: 2, name: 'Two', slug: 'two' },
      { id: 3, name: 'Three', slug: 'three' }
    ],
    slug: 'hylo'
  }

  it('renders group names and "Posted In:" text', () => {
    render(<PostGroups {...defaultProps} />)

    expect(screen.getByText('Posted In:')).toBeInTheDocument()
    expect(screen.getByText('One')).toBeInTheDocument()
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('1 other')).toBeInTheDocument()
  })

  it('expands to show all groups when clicked', () => {
    render(<PostGroups {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    expect(screen.getByText('One')).toBeInTheDocument()
    expect(screen.getByText('Two')).toBeInTheDocument()
    expect(screen.getByText('Three')).toBeInTheDocument()
    expect(screen.queryByText('1 other')).not.toBeInTheDocument()
  })

  it('returns null when in the only group', () => {
    const singleGroupProps = {
      groups: [{ id: 1, name: 'One', slug: 'one' }],
      slug: 'one'
    }

    const { container } = render(<PostGroups {...singleGroupProps} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Public" icon for public groups', () => {
    const propsWithPublicGroup = {
      ...defaultProps,
      expanded: false,
      groups: [{ id: 4, name: 'Public', slug: 'public' }]
    }

    render(<PostGroups {...propsWithPublicGroup} />)

    // fireEvent.click(screen.getByRole('button', { name: /expand/i }))

    const publicIcon = screen.getByTestId('icon-Public')
    expect(publicIcon).toBeInTheDocument()
    expect(publicIcon.closest('a')).toHaveTextContent('Public')
  })
})
