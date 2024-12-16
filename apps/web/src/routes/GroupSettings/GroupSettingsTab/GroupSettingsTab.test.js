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

    expect(screen.getByLabelText('Group Name')).toHaveValue('Foomunity')
    expect(screen.getByText('Banner and Avatar Images')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('displays "Current settings up to date" when no changes are made', () => {
    renderComponent()

    expect(screen.getByText('Current settings up to date')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toHaveClass('gray')
  })

  it('updates state and button when changes are made', () => {
    renderComponent()

    const nameInput = screen.getByLabelText('Group Name')
    fireEvent.change(nameInput, { target: { value: 'New Group Name' } })

    expect(screen.getByText('Changes not saved')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toHaveClass('green')
  })

  // Add more tests as needed for other functionality
})
