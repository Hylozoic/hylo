import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
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

    expect(screen.getByDisplayValue('Foomunity')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Show a welcome page to new members when they first land in the group.')).toBeInTheDocument()
    expect(screen.queryByText('Edit Welcome Page Content')).not.toBeInTheDocument()
  })

  it('displays "Current settings up to date" when no changes are made', () => {
    renderComponent()

    expect(screen.getByText('Current settings up to date')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })

  it('saves the Introduction template members start from', async () => {
    const updateGroupSettings = jest.fn()
    const { container } = renderComponent({
      group: { ...group, location: '', settings: { introTemplate: 'Say hello' } },
      currentUser: {},
      updateGroupSettings
    })
    const field = container.querySelector('#introTemplateField')
    expect(field).toHaveValue('Say hello')
    expect(screen.getByText('Introduction template')).toBeInTheDocument()

    fireEvent.change(field, { target: { value: 'Tell us where you farm' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await waitFor(() => expect(updateGroupSettings).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ introTemplate: 'Tell us where you farm' })
    })))
  })

  it('updates state and button when changes are made', () => {
    renderComponent()

    const nameInput = screen.getByDisplayValue('Foomunity')
    fireEvent.change(nameInput, { target: { value: 'New Group Name' } })

    expect(screen.getByText('Changes not saved')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
  })
})
