import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupButton from './GroupButton'

describe('GroupButton', () => {
  it('renders group name and avatar', () => {
    const props = {
      group: {
        id: '53',
        name: 'Backyard Birders',
        slug: 'bb',
        memberCount: 11,
        avatarUrl: 'https://d3ngex8q79bk55.cloudfront.net/misc/default_community_avatar.png',
        network: '1'
      }
    }

    render(
      <GroupButton {...props} />
    )

    // Check if the group name is rendered
    expect(screen.getByText('Backyard Birders')).toBeInTheDocument()

    // Check if the avatar image is rendered with the correct src
    const avatarImage = screen.getByRole('img')
    expect(avatarImage.getAttribute('style')).toContain(props.group.avatarUrl)

    // Check if the link has the correct href
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/groups/${props.group.slug}`)
  })
})
