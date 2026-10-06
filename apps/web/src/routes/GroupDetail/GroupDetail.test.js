import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import { useLocation, useParams } from 'react-router-dom'
import orm from 'store/models'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import GroupDetail from './GroupDetail'

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

function mockInvitation ({ requiresApproval, invitedBy }) {
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
        email: INVITEE_EMAIL,
        groupRole: null,
        requiresApproval,
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
