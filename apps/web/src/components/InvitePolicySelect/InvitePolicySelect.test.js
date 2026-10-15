import React from 'react'
import { fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import InvitePolicySelect from './InvitePolicySelect'

const APPROVAL = 'Every member can invite people. A steward approves each person before they join.'
const NO_APPROVAL = 'Every member can invite people, and the people they invite join right away.'
const STEWARDS = 'Only roles that include Add Members can invite people: Administrators, Hosts and any custom role you give it.'

describe('InvitePolicySelect', () => {
  it('offers everyone or stewards', () => {
    const onModeChange = jest.fn()
    render(<InvitePolicySelect mode='stewards' onModeChange={onModeChange} accessibility={GROUP_ACCESSIBILITY.Restricted} />)

    expect(screen.getByText(STEWARDS)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Who can add new members?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Everyone in the Group' }))
    expect(onModeChange).toHaveBeenCalledWith('everyone')
  })

  it('says stewards approve invited people except in Open groups', () => {
    const { rerender } = render(<InvitePolicySelect mode='everyone' onModeChange={jest.fn()} accessibility={GROUP_ACCESSIBILITY.Closed} />)
    expect(screen.getByText(APPROVAL)).toBeInTheDocument()

    rerender(<InvitePolicySelect mode='everyone' onModeChange={jest.fn()} accessibility={GROUP_ACCESSIBILITY.Open} />)
    expect(screen.getByText(NO_APPROVAL)).toBeInTheDocument()
    expect(screen.queryByText(APPROVAL)).not.toBeInTheDocument()
  })
})
