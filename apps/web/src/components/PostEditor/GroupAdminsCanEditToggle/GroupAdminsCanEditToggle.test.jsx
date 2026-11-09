import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import userEvent from '@testing-library/user-event'
import GroupAdminsCanEditToggle from './GroupAdminsCanEditToggle'
import { singleRootGroupId } from '../PostEditor'

describe('GroupAdminsCanEditToggle', () => {
  it('is an icon toggle button labelled with the group name, and calls the toggle when clicked', async () => {
    const toggle = jest.fn()
    render(<GroupAdminsCanEditToggle groupAdminsCanEdit={false} toggleGroupAdminsCanEdit={toggle} groupName='Test Group' activeIconClassName='is-on' />)
    const button = screen.getByRole('button', { name: 'Allow other members who can manage content in Test Group to edit this post.' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('data-tooltip-content', 'Allow other members who can manage content in Test Group to edit this post.')
    expect(button.querySelector('svg')).not.toHaveClass('is-on')
    await userEvent.click(button)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('shows the on state', () => {
    render(<GroupAdminsCanEditToggle groupAdminsCanEdit toggleGroupAdminsCanEdit={jest.fn()} groupName='Test Group' activeIconClassName='is-on' />)
    const button = screen.getByTestId('post-editor-group-admins-can-edit')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button.querySelector('svg')).toHaveClass('is-on')
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
