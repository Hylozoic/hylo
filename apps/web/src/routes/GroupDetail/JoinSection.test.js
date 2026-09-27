import React from 'react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import JoinSection from './JoinSection'

const sponsor = { id: '7', name: 'Ada Member', avatarUrl: null }

const REQUEST_TEXT = 'Request Membership in {{group.name}}'
const JOIN_TEXT = 'Join {{group.name}}'
const INVITE_ONLY_TEXT = 'This group is invite only. You require a join or invite link in order to join.'

function renderJoinSection ({ accessibility, groupsWithPendingRequests = {}, ...props }) {
  const joinGroup = jest.fn()
  const requestToJoinGroup = jest.fn()

  function JoinSectionWithT () {
    const { t } = useTranslation()
    return (
      <JoinSection
        currentUser={{ id: '1' }}
        fullPage
        group={{ id: '1', name: 'Garden Club', slug: 'garden', accessibility, settings: {} }}
        groupsWithPendingRequests={groupsWithPendingRequests}
        joinGroup={joinGroup}
        requestToJoinGroup={requestToJoinGroup}
        routeParams={{}}
        t={t}
        {...props}
      />
    )
  }

  render(<JoinSectionWithT />)
  return { joinGroup, requestToJoinGroup }
}

const memberInvitation = {
  invitationToken: 'member-token',
  invitationRequiresApproval: true,
  invitedBy: sponsor
}

describe('JoinSection with a member invitation that needs approval', () => {
  it('shows who invited the person and asks to join a Restricted group', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Restricted,
      ...memberInvitation
    })

    expect(screen.getByText('Ada Member invited you')).toBeInTheDocument()
    expect(screen.getByText('Stewards review every request to join this group.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: JOIN_TEXT })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: REQUEST_TEXT }))

    expect(requestToJoinGroup).toHaveBeenCalledWith('1', [])
    expect(joinGroup).not.toHaveBeenCalled()
  })

  it('asks to join a Closed group instead of saying it is invite only', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      ...memberInvitation
    })

    expect(screen.getByText('Ada Member invited you')).toBeInTheDocument()
    expect(screen.queryByText(INVITE_ONLY_TEXT)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: REQUEST_TEXT }))

    expect(requestToJoinGroup).toHaveBeenCalledWith('1', [])
    expect(joinGroup).not.toHaveBeenCalled()
  })

  it('shows the pending request once the person has asked', () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      groupsWithPendingRequests: { 1: { id: '9' } },
      ...memberInvitation
    })

    expect(screen.getByText('Request to join pending')).toBeInTheDocument()
    expect(screen.queryByText('Ada Member invited you')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REQUEST_TEXT })).not.toBeInTheDocument()
    expect(screen.queryByText(INVITE_ONLY_TEXT)).not.toBeInTheDocument()
  })

  it('still asks to join when the sender is unknown, without a banner', () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      ...memberInvitation,
      invitedBy: null
    })

    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: REQUEST_TEXT })).toBeInTheDocument()
  })
})

describe('JoinSection without a member invitation', () => {
  it('lets a steward invitation join a Closed group directly', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      invitationToken: 'steward-token',
      invitationRequiresApproval: false,
      invitedBy: null
    })

    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))

    expect(joinGroup).toHaveBeenCalledWith('1', [])
    expect(requestToJoinGroup).not.toHaveBeenCalled()
  })

  it('lets a join link join a Restricted group directly', () => {
    renderJoinSection({ accessibility: GROUP_ACCESSIBILITY.Restricted, accessCode: 'join-code' })

    expect(screen.getByRole('button', { name: JOIN_TEXT })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REQUEST_TEXT })).not.toBeInTheDocument()
  })

  it('joins an Open group directly with no banner, even from a member invitation', async () => {
    const user = userEvent.setup()
    const { joinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Open,
      invitationToken: 'member-token',
      invitationRequiresApproval: false,
      invitedBy: sponsor
    })

    expect(screen.queryByText('Ada Member invited you')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))

    expect(joinGroup).toHaveBeenCalledWith('1', [])
  })

  it('asks to join a Restricted group with no link', () => {
    renderJoinSection({ accessibility: GROUP_ACCESSIBILITY.Restricted })

    expect(screen.getByRole('button', { name: REQUEST_TEXT })).toBeInTheDocument()
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
  })

  it('says a Closed group with no link is invite only', () => {
    renderJoinSection({ accessibility: GROUP_ACCESSIBILITY.Closed })

    expect(screen.getByText(INVITE_ONLY_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REQUEST_TEXT })).not.toBeInTheDocument()
  })
})
