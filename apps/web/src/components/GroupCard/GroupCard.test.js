import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupCard from './GroupCard'

const props = {
  group: {
    id: 1,
    name: 'A Great Cause',
    slug: 'great-cause',
    groupTopics: {
      toModelArray: () => [
        { topic: { name: 'Life', id: '1wooooop' } },
        { topic: { name: 'Love', id: '2wooooop' } },
        { topic: { name: 'Light', id: '3wooooop' } },
        { topic: { name: 'LOLS', id: '4wooooop' } }
      ]
    },
    members: {
      toModelArray: () => [
        { avatarUrl: 'https://example.com/avatar1.png' },
        { avatarUrl: 'https://example.com/avatar2.png' }
      ]
    },
    description: 'the description '.repeat(5)
  },
  expanded: false,
  memberships: [1, 12, 24, 25, 346]
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

  it('renders the group description', () => {
    renderGroupCard()
    expect(screen.getByText(/the description/)).toBeInTheDocument()
  })

  it('renders a link to the group page', () => {
    renderGroupCard()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/groups/great-cause')
  })

  it('renders with constrained prop', () => {
    renderGroupCard({ constrained: true })
    const card = screen.getByTestId('group-card')
    expect(card).toHaveClass('constrained')
  })

  it('renders with expanded prop', () => {
    renderGroupCard({ expanded: true })
    const card = screen.getByTestId('group-card')
    expect(card).toHaveClass('expanded')
  })
})
