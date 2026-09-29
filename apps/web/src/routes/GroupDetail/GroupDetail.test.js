import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import { useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GroupDetail from './GroupDetail'

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

const group = {
  id: '1',
  name: 'Garden Club',
  slug: 'garden',
  accessibility: GROUP_ACCESSIBILITY.Closed,
  visibility: GROUP_VISIBILITY.Hidden,
  settings: {}
}

const INVITEE_EMAIL = 'newcomer@example.com'

function providers () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '10', name: 'New Comer', email: INVITEE_EMAIL })
  ormSession.Group.create(group)
  return AllTheProviders({ orm: ormSession.state, pending: {} })
}

function mockInvitation ({ requiresApproval, invitedBy, email = INVITEE_EMAIL, isMemberLink = false, tryLater = false }) {
  return graphql.query('CheckInvitation', () => HttpResponse.json({
    data: {
      checkInvitation: {
        valid: true,
        groupId: group.id,
        groupSlug: group.slug,
        groupName: group.name,
        isSpace: false,
        parentGroupSlug: null,
        parentGroupName: null,
        email,
        groupRole: null,
        requiresApproval,
        isMemberLink,
        tryLater,
        invitedBy
      }
    }
  }))
}

beforeEach(() => {
  useParams.mockReturnValue({ groupSlug: group.slug })
  useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '?token=member-token', hash: '' })
  mockGraphqlServer.use(
    graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group } }))
  )
})

afterEach(() => {
  jest.restoreAllMocks()
  toast.error.mockClear()
  useParams.mockReturnValue({})
  useLocation.mockReturnValue({ pathname: '', search: '' })
})

describe('GroupDetail with a member invitation', () => {
  it('sends the invitation token with the request to join and then shows it pending', async () => {
    const user = userEvent.setup()
    let requestVariables
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: true, invitedBy: { id: '7', name: 'Ada Member', avatarUrl: null } }),
      graphql.mutation('CreateJoinRequest', ({ variables }) => {
        requestVariables = variables
        return HttpResponse.json({
          data: {
            createJoinRequest: {
              request: { id: '9', user: { id: '10' }, group: { id: group.id }, createdAt: null, updatedAt: null, status: 0 }
            }
          }
        })
      })
    )

    render(<GroupDetail />, null, providers())

    expect(await screen.findByText('Ada Member invited you')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Request Membership in {{group.name}}' }))

    await waitFor(() => expect(requestVariables).toEqual({
      groupId: group.id,
      questionAnswers: [],
      invitationToken: 'member-token'
    }))
    expect(await screen.findByText('Request to join pending')).toBeInTheDocument()
  })

  it('drops an invitation that stopped working and says so', async () => {
    const user = userEvent.setup()
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    const navigateMock = jest.fn()
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigateMock)
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: true, invitedBy: { id: '7', name: 'Ada Member', avatarUrl: null } }),
      graphql.mutation('CreateJoinRequest', () => HttpResponse.json({
        errors: [{ message: 'This invitation cannot be used to request to join this group' }],
        data: { createJoinRequest: null }
      }))
    )

    render(<GroupDetail />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Request Membership in {{group.name}}' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/groups/garden/about', { replace: true }))
    expect(alertSpy).toHaveBeenCalledWith('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.')
    expect(screen.queryByText('Ada Member invited you')).not.toBeInTheDocument()
  })

  it('joins directly with a steward invitation and sends no request', async () => {
    const user = userEvent.setup()
    let joinVariables
    let requested = false
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: false, invitedBy: null }),
      graphql.mutation('CreateJoinRequest', () => {
        requested = true
        return HttpResponse.json({ data: { createJoinRequest: null } })
      }),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('joinGroup(')) return
        joinVariables = variables
        return HttpResponse.json({ data: {} })
      })
    )

    render(<GroupDetail />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Join {{group.name}}' }))

    await waitFor(() => expect(joinVariables).toMatchObject({ groupId: group.id, invitationToken: 'member-token' }))
    expect(requested).toBe(false)
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
  })
})

describe("GroupDetail with a member's personal invite link", () => {
  const MEMBER_CODE = 'MemberCode123456'
  const adaMember = { id: '7', name: 'Ada Member', avatarUrl: null }

  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: `?accessCode=${MEMBER_CODE}`, hash: '' })
  })

  it('sends the link code with the request to join, without a token, and shows it pending', async () => {
    const user = userEvent.setup()
    let requestVariables
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: true, invitedBy: adaMember, email: null, isMemberLink: true }),
      graphql.mutation('CreateJoinRequest', ({ variables }) => {
        requestVariables = variables
        return HttpResponse.json({
          data: {
            createJoinRequest: {
              request: { id: '9', user: { id: '10' }, group: { id: group.id }, createdAt: null, updatedAt: null, status: 0 }
            }
          }
        })
      })
    )

    render(<GroupDetail />, null, providers())

    expect(await screen.findByText('Ada Member invited you')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Request Membership in {{group.name}}' }))

    await waitFor(() => expect(requestVariables).toEqual({
      groupId: group.id,
      questionAnswers: [],
      accessCode: MEMBER_CODE
    }))
    expect(await screen.findByText('Request to join pending')).toBeInTheDocument()
  })

  it('says to try again later when the link reached its daily limit after the page loaded', async () => {
    const user = userEvent.setup()
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    const navigateMock = jest.fn()
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigateMock)
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: true, invitedBy: adaMember, email: null, isMemberLink: true }),
      graphql.mutation('CreateJoinRequest', () => HttpResponse.json({
        errors: [{ message: 'invite-try-later' }],
        data: { createJoinRequest: null }
      }))
    )

    render(<GroupDetail />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Request Membership in {{group.name}}' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/groups/garden/about', { replace: true }))
    expect(alertSpy).toHaveBeenCalledWith("This invite link can't be used right now. Please try again later.")
    expect(screen.queryByText('Ada Member invited you')).not.toBeInTheDocument()
  })
})

describe("GroupDetail with the group's join link", () => {
  it('joins directly with the code and sends no request with it', async () => {
    const user = userEvent.setup()
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '?accessCode=groupcode', hash: '' })
    let joinVariables
    let requested = false
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: null, invitedBy: null, email: null }),
      graphql.mutation('CreateJoinRequest', () => {
        requested = true
        return HttpResponse.json({ data: { createJoinRequest: null } })
      }),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('joinGroup(')) return
        joinVariables = variables
        return HttpResponse.json({ data: {} })
      })
    )

    render(<GroupDetail />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Join {{group.name}}' }))

    await waitFor(() => expect(joinVariables).toMatchObject({ groupId: group.id, accessCode: 'groupcode' }))
    expect(requested).toBe(false)
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
  })
})

describe('GroupDetail after an invalid invitation redirect', () => {
  it('shows the invalid invitation toast when JoinGroup redirected here with one', async () => {
    useParams.mockReturnValue({ groupSlug: 'test-group' })
    useLocation.mockReturnValue({ pathname: '/groups/test-group/about', search: '', state: { invalidInvite: true } })

    render(<GroupDetail />)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.',
        { id: 'invalid-invite' }
      )
    })
  })

  it('does not show the invalid invitation toast otherwise', async () => {
    useParams.mockReturnValue({ groupSlug: 'test-group' })
    useLocation.mockReturnValue({ pathname: '/groups/test-group/about', search: '' })

    render(<GroupDetail />)

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('GroupDetail when the group cannot be loaded', () => {
  function emptyProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Me.create({ id: '10', name: 'New Comer', email: INVITEE_EMAIL })
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '', hash: '' })
  })

  it('offers to try again after a server error instead of saying not found', async () => {
    let attempts = 0
    mockGraphqlServer.use(graphql.query('GroupDetailsQuery', () => {
      attempts += 1
      if (attempts === 1) return new HttpResponse('Server error', { status: 500 })
      return HttpResponse.json({ data: { group } })
    }))
    render(<GroupDetail forCurrentGroup />, { wrapper: emptyProviders() })

    await screen.findByTestId('load-failed')
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try Again' }))
    await waitFor(() => expect(attempts).toBe(2))
  })

  it('still says not found when there is no such group', async () => {
    mockGraphqlServer.use(graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: null } })))
    render(<GroupDetail forCurrentGroup />, { wrapper: emptyProviders() })

    await screen.findByText('404 Not Found')
    expect(screen.queryByTestId('load-failed')).not.toBeInTheDocument()
  })
})

describe('GroupDetail for someone not signed in with an invitation', () => {
  const steward = { id: '8', name: 'Sam Steward', avatarUrl: null }

  function signedOutProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    ormSession.Group.create(group)
    return AllTheProviders({ orm: ormSession.state, pending: {} })
  }

  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '?token=steward-token', hash: '' })
    try { window.localStorage.removeItem('returnToPath') } catch (e) {}
  })

  it('says who invited them and logs in without dropping the invitation', async () => {
    mockGraphqlServer.use(mockInvitation({ requiresApproval: false, invitedBy: steward }))
    render(<GroupDetail />, null, signedOutProviders())

    expect(await screen.findByText('Sam Steward invited you')).toBeInTheDocument()
    expect(screen.queryByText('Stewards review every request to join this group.')).not.toBeInTheDocument()
    expect(screen.getByTestId('signed-out-log-in'))
      .toHaveAttribute('href', `/login?returnToUrl=${encodeURIComponent('/groups/garden/about?token=steward-token')}`)
    expect(screen.queryByText('Signup or Login to connect with')).not.toBeInTheDocument()
  })

  it('signs up with the invited email filled in and the invitation kept to come back to', async () => {
    const user = userEvent.setup()
    const navigateMock = jest.fn()
    jest.spyOn(require('react-router-dom'), 'useNavigate').mockReturnValue(navigateMock)
    mockGraphqlServer.use(mockInvitation({ requiresApproval: false, invitedBy: steward }))
    render(<GroupDetail />, null, signedOutProviders())

    await screen.findByText('Sam Steward invited you')
    await user.click(screen.getByRole('button', { name: 'Sign up to join Garden Club' }))

    expect(navigateMock).toHaveBeenCalledWith('/signup', { state: { email: INVITEE_EMAIL } })
    expect(JSON.parse(window.localStorage.getItem('returnToPath'))).toBe('/groups/garden/about?token=steward-token')
  })
})

describe('GroupDetail as one combined join screen for a valid invitation', () => {
  const steward = { id: '8', name: 'Sam Steward', avatarUrl: null }
  const withAgreements = {
    ...group,
    agreements: { items: [{ id: 'a1', title: 'Be kind', description: 'Please be kind', order: 1 }] }
  }

  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '?token=steward-token', hash: '' })
    mockGraphqlServer.use(
      graphql.query('GroupDetailsQuery', () => HttpResponse.json({ data: { group: withAgreements } }))
    )
  })

  it('lists the agreements once, open, with a single Join that works once they are accepted', async () => {
    const user = userEvent.setup()
    let joinVariables
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: false, invitedBy: steward }),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('joinGroup(')) return
        joinVariables = variables
        return HttpResponse.json({ data: {} })
      })
    )

    render(<GroupDetail />, null, providers())

    expect(await screen.findByText('Sam Steward invited you')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument())
    expect(screen.getAllByText('Be kind')).toHaveLength(1)
    const join = screen.getByRole('button', { name: 'Join {{group.name}}' })
    expect(join).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    await user.click(join)

    await waitFor(() => expect(joinVariables).toMatchObject({ groupId: group.id, invitationToken: 'steward-token', acceptAgreements: true }))
  })

  it('says so when the person was blocked from rejoining', async () => {
    const user = userEvent.setup()
    mockGraphqlServer.use(
      mockInvitation({ requiresApproval: false, invitedBy: steward }),
      graphql.operation(({ query }) => {
        if (!query.includes('joinGroup(')) return
        return HttpResponse.json({ errors: [{ message: "You can't join this group" }], data: { joinGroup: null } })
      })
    )

    render(<GroupDetail />, null, providers())

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument())
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Join {{group.name}}' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("You can't join this group"))
  })

  it('keeps the agreements in the About without an invitation', async () => {
    useLocation.mockReturnValue({ pathname: '/groups/garden/about', search: '', hash: '' })
    render(<GroupDetail />, null, providers())

    expect(await screen.findByText('Please be kind')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
