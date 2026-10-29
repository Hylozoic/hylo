import React from 'react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import JoinSection from './JoinSection'

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

describe('JoinSection with an email invitation', () => {
  it('joins a Restricted group directly', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Restricted,
      invitationToken: 'member-token'
    })

    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))

    expect(joinGroup).toHaveBeenCalledWith('1', [])
    expect(requestToJoinGroup).not.toHaveBeenCalled()
  })

  it('joins a Closed group instead of saying it is invite only', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      invitationToken: 'member-token'
    })

    expect(screen.queryByText(INVITE_ONLY_TEXT)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))

    expect(joinGroup).toHaveBeenCalledWith('1', [])
    expect(requestToJoinGroup).not.toHaveBeenCalled()
  })
})

describe('JoinSection without an invitation', () => {
  it('lets a granting join link join a Restricted group directly', () => {
    renderJoinSection({ accessibility: GROUP_ACCESSIBILITY.Restricted, accessCode: 'join-code', grantAccess: true })

    expect(screen.getByRole('button', { name: JOIN_TEXT })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REQUEST_TEXT })).not.toBeInTheDocument()
  })

  it('asks to join a Restricted group through a view-only link', () => {
    renderJoinSection({ accessibility: GROUP_ACCESSIBILITY.Restricted, accessCode: 'join-code', grantAccess: false })

    expect(screen.getByRole('button', { name: REQUEST_TEXT })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: JOIN_TEXT })).not.toBeInTheDocument()
  })

  it('joins an Open group directly', async () => {
    const user = userEvent.setup()
    const { joinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Open,
      invitationToken: 'member-token'
    })

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
