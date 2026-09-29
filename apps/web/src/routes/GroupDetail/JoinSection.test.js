import React from 'react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Route, Routes } from 'react-router-dom'
import { GROUP_ACCESSIBILITY } from 'store/models/Group'
import getReturnToPath from 'store/selectors/getReturnToPath'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import JoinSection, { SignedOutJoinPrompt } from './JoinSection'

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

  it('joins an Open group directly from a member invitation, saying who invited the person but not that stewards review it', async () => {
    const user = userEvent.setup()
    const { joinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Open,
      invitationToken: 'member-token',
      invitationRequiresApproval: false,
      invitedBy: sponsor
    })

    expect(screen.getByText('Ada Member invited you')).toBeInTheDocument()
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))

    expect(joinGroup).toHaveBeenCalledWith('1', [])
  })

  it('names the steward who sent an email invitation to a Closed group', () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      invitationToken: 'steward-token',
      invitationRequiresApproval: false,
      invitedBy: { id: '8', name: 'Sam Steward', avatarUrl: null }
    })

    expect(screen.getByText('Sam Steward invited you')).toBeInTheDocument()
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: JOIN_TEXT })).toBeInTheDocument()
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

describe("JoinSection with a member's personal invite link", () => {
  it('asks to join a Closed group, showing who invited the person', async () => {
    const user = userEvent.setup()
    const { joinGroup, requestToJoinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      accessCode: 'member-link-code',
      invitationRequiresApproval: true,
      invitedBy: sponsor
    })

    expect(screen.getByText('Ada Member invited you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: JOIN_TEXT })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: REQUEST_TEXT }))

    expect(requestToJoinGroup).toHaveBeenCalledWith('1', [])
    expect(joinGroup).not.toHaveBeenCalled()
  })

  it('says to try again later, and offers no way in, once the link has been used as often as it can be today', () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Open,
      accessCode: 'member-link-code',
      invitationTryLater: true,
      invitedBy: sponsor
    })

    expect(screen.getByText("This invite link can't be used right now. Please try again later.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: JOIN_TEXT })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: REQUEST_TEXT })).not.toBeInTheDocument()
  })
})

describe('JoinSection as one combined join screen for a valid invitation', () => {
  const groupWithBarriers = {
    id: '1',
    name: 'Garden Club',
    slug: 'garden',
    accessibility: GROUP_ACCESSIBILITY.Closed,
    settings: { askJoinQuestions: true },
    agreements: [{ id: 'a1', title: 'Be kind', description: 'Treat people **well**' }],
    joinQuestions: [{ questionId: 'q1', text: 'What brings you here?' }]
  }

  it('shows the agreements and questions already open, and enables the single Join button once they are done', async () => {
    const user = userEvent.setup()
    const { joinGroup } = renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      group: groupWithBarriers,
      invitationToken: 'steward-token',
      invitationRequiresApproval: false,
      expandJoinForm: true
    })

    expect(screen.getByText('Be kind')).toBeInTheDocument()
    expect(screen.getByText('What brings you here?')).toBeInTheDocument()
    const join = screen.getByRole('button', { name: JOIN_TEXT })
    expect(join).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    expect(join).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Type your answer here...'), 'Growing food')
    expect(join).toBeEnabled()

    await user.click(join)
    expect(joinGroup).toHaveBeenCalledTimes(1)
    expect(joinGroup).toHaveBeenCalledWith('1', [expect.objectContaining({ questionId: 'q1', answer: 'Growing food' })])
  })

  it('shows agreement descriptions formatted', () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      group: groupWithBarriers,
      invitationToken: 'steward-token',
      expandJoinForm: true
    })

    expect(screen.getByText('well').tagName).toBe('STRONG')
  })

  it('keeps the agreements behind the Join button without an invitation', async () => {
    const user = userEvent.setup()
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Open,
      group: { ...groupWithBarriers, accessibility: GROUP_ACCESSIBILITY.Open }
    })

    expect(screen.queryByText('Be kind')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: JOIN_TEXT }))
    expect(screen.getByText('Be kind')).toBeInTheDocument()
  })

  it("keeps a member's sponsored request on the same screen, open, with who invited the person", () => {
    renderJoinSection({
      accessibility: GROUP_ACCESSIBILITY.Closed,
      group: groupWithBarriers,
      ...memberInvitation,
      expandJoinForm: true
    })

    expect(screen.getByText('Ada Member invited you')).toBeInTheDocument()
    expect(screen.getByText('Stewards review every request to join this group.')).toBeInTheDocument()
    expect(screen.getByText('What brings you here?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: REQUEST_TEXT })).toBeDisabled()
  })
})

describe('SignedOutJoinPrompt', () => {
  const RETURN_PATH = '/groups/garden/about?token=steward-token'

  function renderPrompt (props = {}) {
    function SignupPage () {
      const returnToPath = useSelector(getReturnToPath)
      const { state } = jest.requireActual('react-router-dom').useLocation()
      return <div>Signup page {returnToPath} {state?.email}</div>
    }
    render(
      <Routes>
        <Route
          path='/groups/garden/about'
          element={
            <SignedOutJoinPrompt
              group={{ id: '1', name: 'Garden Club', slug: 'garden' }}
              invitedBy={{ id: '8', name: 'Sam Steward', avatarUrl: null }}
              invitationEmail='newcomer@example.com'
              returnToPath={RETURN_PATH}
              {...props}
            />
          }
        />
        <Route path='/signup' element={<SignupPage />} />
      </Routes>,
      { wrapper: AllTheProviders({}, [RETURN_PATH]) }
    )
  }

  it('says who invited the person, and logs in without dropping the invitation', () => {
    renderPrompt()
    expect(screen.getByText('Sam Steward invited you')).toBeInTheDocument()
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
    expect(screen.getByTestId('signed-out-log-in')).toHaveAttribute('href', `/login?returnToUrl=${encodeURIComponent(RETURN_PATH)}`)
  })

  it('signs up with the invited email filled in, returning to the invitation afterwards', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('button', { name: 'Sign up to join Garden Club' }))
    expect(await screen.findByText(`Signup page ${RETURN_PATH} newcomer@example.com`)).toBeInTheDocument()
  })

  it('says stewards review a request from a member invitation', () => {
    renderPrompt({ invitationRequiresApproval: true })
    expect(screen.getByText('Stewards review every request to join this group.')).toBeInTheDocument()
  })
})
