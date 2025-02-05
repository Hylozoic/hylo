import React from 'react'
import { render, screen, AllTheProviders, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import Members, { twoByTwo } from './Members'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ groupSlug: 'goteam' }),
  useLocation: () => ({ search: '' })
}))

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({
    id: '1',
    name: 'You',
    memberships: [ormSession.Membership.create({
      id: '1',
      group: '1'
    })],
    membershipCommonRoles: [{ commonRoleId: '1', groupId: '1', userId: '1', id: '1' }]
  })
  ormSession.CommonRole.create({ id: '1', name: 'Coordinator', responsibilities: [{ id: '1', title: 'Administration' }, { id: '2', title: 'Add Members' }] })
  ormSession.Group.create({
    id: '1',
    slug: 'goteam',
    name: 'Go Team',
    memberCount: 3,
    members: [
      { id: '1', name: 'You', membershipCommonRoles: [{ id: '1', commonRoleId: '1', groupId: '1' }] },
      { id: '2', name: 'Me', membershipCommonRoles: [{ id: '2', commonRoleId: '1', groupId: '1' }] },
      { id: '3', name: 'Everyone', membershipCommonRoles: [{ id: '3', commonRoleId: '1', groupId: '1' }] }
    ],
    membershipCommonRoles: [
      { commonRoleId: '1', groupId: '1', userId: '1', id: '1' },
      { commonRoleId: '1', groupId: '1', userId: '2', id: '2' },
      { commonRoleId: '1', groupId: '1', userId: '3', id: '3' }
    ]
  })

  const reduxState = { orm: ormSession.state, pending: {} }

  return AllTheProviders(reduxState)
}

describe('Members component', () => {
  beforeAll(() => {
    const centerColumn = document.createElement('div')
    centerColumn.id = CENTER_COLUMN_ID
    document.body.appendChild(centerColumn)
  })

  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchGroupMembers', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            group: {
              id: '1',
              name: 'Go Team',
              memberCount: 3,
              members: { items: [{ id: '1', name: 'You' }, { id: '2', name: 'Me' }, { id: '3', name: 'Everyone' }] }
            }
          }
        })
      })
    )
  })

  it('renders members and total count', async () => {
    render(<Members />, { wrapper: testProviders() })

    await waitFor(() => {
      expect(screen.getByText('Members')).toBeInTheDocument()
      expect(screen.getByText('3 Total Members')).toBeInTheDocument()
      expect(screen.getAllByTestId('member-card')).toHaveLength(3)
      expect(screen.getByText('You')).toBeInTheDocument()
      expect(screen.getByText('Me')).toBeInTheDocument()
      expect(screen.getByText('Everyone')).toBeInTheDocument()
    })
  })

  it('renders invite button when user has permission', async () => {
    render(<Members />, { wrapper: testProviders() })

    await waitFor(() => {
      expect(screen.getByText('Invite People')).toBeInTheDocument()
    })
  })
})

describe('twoByTwo', () => {
  it('groups items into pairs', () => {
    expect(twoByTwo([1, 2, 3, 4, 5, 6, 7])).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [7]
    ])
  })
})
