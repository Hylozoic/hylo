import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import DeleteSettingsTab from './DeleteSettingsTab'

describe('DeleteSettingsTab', () => {
  const group = {
    id: 1,
    name: 'Hylo'
  }

  const deleteGroup = jest.fn()

  it('renders correctly', () => {
    render(<DeleteSettingsTab group={group} deleteGroup={deleteGroup} />)

    expect(screen.getByText('Delete Hylo', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('If you delete this group', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Group' })).toBeInTheDocument()
  })

  it('does not call deleteGroup when not confirmed', () => {
    window.confirm = jest.fn(() => false)

    render(<DeleteSettingsTab group={group} deleteGroup={deleteGroup} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Group' }))

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete the group Hylo?')
    expect(deleteGroup).not.toHaveBeenCalled()
  })

  it('calls deleteGroup when confirmed', () => {
    window.confirm = jest.fn(() => true)

    render(<DeleteSettingsTab group={group} deleteGroup={deleteGroup} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Group' }))

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete the group Hylo?')
    expect(deleteGroup).toHaveBeenCalled()
  })
})
