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
