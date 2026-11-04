import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
import GroupAdminsCanEditToggle from './GroupAdminsCanEditToggle'
import { singleRootGroupId } from '../PostEditor'

describe('GroupAdminsCanEditToggle', () => {
  it('shows its state and calls the toggle when clicked', async () => {
    const toggle = jest.fn()
    render(<GroupAdminsCanEditToggle groupAdminsCanEdit={false} toggleGroupAdminsCanEdit={toggle} groupName='Test Group' />)
    const row = screen.getByTestId('post-editor-group-admins-can-edit')
    expect(row).toHaveAttribute('aria-checked', 'false')
    expect(row).toHaveTextContent('Let group admins edit')
    await userEvent.click(row)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('describes the on state', () => {
    render(<GroupAdminsCanEditToggle groupAdminsCanEdit toggleGroupAdminsCanEdit={jest.fn()} groupName='Test Group' />)
    expect(screen.getByTestId('post-editor-group-admins-can-edit')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('post-editor-group-admins-can-edit')).toHaveTextContent('Group admins can edit')
  })
})

describe('singleRootGroupId', () => {
  const group = { id: '1', type: null }
  const space = { id: '2', type: 'space', parentId: '1' }
  const otherSpace = { id: '3', type: 'space', parentId: '1' }
  const otherGroup = { id: '4' }

  it('returns the group for a group and its spaces', () => {
    expect(singleRootGroupId([group, space, otherSpace])).toEqual('1')
    expect(singleRootGroupId([space])).toEqual('1')
  })

  it('returns null for several groups or none', () => {
    expect(singleRootGroupId([group, otherGroup])).toBeNull()
    expect(singleRootGroupId([space, otherGroup])).toBeNull()
    expect(singleRootGroupId([])).toBeNull()
  })
})
