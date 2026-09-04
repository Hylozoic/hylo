import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupCard from './GroupCard'

const props = {
  group: {
    id: 1,
    name: 'A Great Cause',
    slug: 'great-cause',
    memberCount: 12,
    memberStatus: 'member',
    description: 'the description '.repeat(5)
  }
}

const renderGroupCard = (customProps = {}) => {
  const mergedProps = { ...props, ...customProps }
  return render(
    <GroupCard {...mergedProps} />
  )
}

describe('GroupCard', () => {
  it('renders the group name', () => {
    renderGroupCard()
    expect(screen.getByText('A Great Cause')).toBeInTheDocument()
  })

  it('renders member count', () => {
    renderGroupCard()
    expect(screen.getByText('12 Members')).toBeInTheDocument()
  })

  it('renders a link to the group page for members', () => {
    renderGroupCard()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/groups/great-cause')
  })

  it('renders join state for non-members', () => {
    renderGroupCard({ group: { ...props.group, memberStatus: 'not a member' } })
    expect(screen.getByText('Join')).toBeInTheDocument()
  })
})
