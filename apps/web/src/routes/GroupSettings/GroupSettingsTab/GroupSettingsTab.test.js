import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import GroupSettingsTab from './GroupSettingsTab'

describe('GroupSettingsTab', () => {
  const group = {
    id: '1',
    name: 'Foomunity',
    slug: 'foo',
    locationObject: { id: '1', name: 'Fuji' },
    description: 'Great group',
    avatarUrl: 'avatar.png',
    bannerUrl: 'banner.png',
    customViews: [{
      activePostsOnly: false,
      externalLink: 'https://google.com',
      icon: 'Public',
      isActive: true,
      name: 'custommm baby',
      order: 1,
      postTypes: [],
      topics: [],
      type: 'externalLink'
    }]
  }

  const renderComponent = (props = {}) => {
    return render(
      <GroupSettingsTab group={group} {...props} />
    )
  }

  it('renders correctly', () => {
    renderComponent()

    expect(screen.getByText('Change group icon')).toBeInTheDocument()
    expect(screen.getByText('Change group banner')).toBeInTheDocument()
    expect(screen.getByText('Purpose Statement')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toHaveValue('Great group')
  })

  it('displays "Current settings up to date" when no changes are made', () => {
    renderComponent()

    expect(screen.getByText('Current settings up to date')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toHaveClass('bg-foreground rounded text-background py-1 px-2 text-bold')
  })

  // Add more tests as needed for other functionality
})
