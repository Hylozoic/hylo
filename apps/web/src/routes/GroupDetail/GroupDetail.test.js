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

function mockInvitation () {
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
        grantAccess: true,
        groupRoles: []
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

describe('GroupDetail with an email invitation', () => {
  it('joins a Closed group with the invitation token', async () => {
    const user = userEvent.setup()
    let joinVariables
    mockGraphqlServer.use(
      mockInvitation(),
      graphql.operation(({ query, variables }) => {
        if (!query.includes('joinGroup(')) return
        joinVariables = variables
        return HttpResponse.json({ data: {} })
      })
    )

    render(<GroupDetail />, null, providers())

    await user.click(await screen.findByRole('button', { name: 'Join {{group.name}}' }))

    await waitFor(() => expect(joinVariables).toMatchObject({ groupId: group.id, invitationToken: 'member-token' }))
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
