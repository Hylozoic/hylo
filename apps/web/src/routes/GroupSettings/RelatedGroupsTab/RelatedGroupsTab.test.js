import React from 'react'
import { render, screen, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import RelatedGroupsTab, { GroupCard } from './RelatedGroupsTab'
import orm from 'store/models'

const parentGroups = []
const childGroups = []

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  parentGroups.push(ormSession.Group.create({ id: '2', name: 'Parent 1', slug: 'parent-1' }))
  parentGroups.push(ormSession.Group.create({ id: '3', name: 'Parent 2', slug: 'parent-2' }))
  parentGroups.push(ormSession.Group.create({ id: '4', name: 'Parent 3', slug: 'parent-3' }))
  childGroups.push(ormSession.Group.create({ id: '5', name: 'Child 1', slug: 'child-1' }))
  childGroups.push(ormSession.Group.create({ id: '6', name: 'Child 2', slug: 'child-2' }))
  childGroups.push(ormSession.Group.create({ id: '7', name: 'Child 3', slug: 'child-3' }))
  ormSession.Group.create({ id: '1', name: 'Best Group', slug: 'best-group', parentGroups: ['2', '3', '4'], childGroups: ['5', '6', '7'] })
  const reduxState = { orm: ormSession.state }
  return AllTheProviders(reduxState)
}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockReturnValue({ context: 'groups', groupSlug: 'best-group' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/groups/best-group', search: '' })
}))

describe('RelatedGroupsTab', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchGroupToGroupJoinQuestions', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            me: {
              memberships: [
                {
                  id: '1',
                  group: {
                    id: '1',
                    groupToGroupJoinQuestions: { items: [] }
                  }
                }
              ]
            }
          }
        })
      })
    )
  })

  it('renders correctly', async () => {
    render(
      <RelatedGroupsTab />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('Parent Groups')).toBeInTheDocument()
      expect(screen.getByText('Child Groups')).toBeInTheDocument()
      expect(screen.getByText('Add Group Relationships')).toBeInTheDocument()
    })

    parentGroups.forEach(parent => {
      expect(screen.getByText(parent.name)).toBeInTheDocument()
    })
    childGroups.forEach(child => {
      expect(screen.getByText(child.name)).toBeInTheDocument()
    })
  })
})

describe('GroupCard', () => {
  it('renders correctly', () => {
    const group = {
      name: 'Foom',
      avatarUrl: 'foom.png',
      numMembers: 77,
      slug: 'foom-group'
    }

    render(<GroupCard group={group} />)

    expect(screen.getByText('Foom')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Foom' })).toHaveAttribute('href', '/groups/foom-group')
    expect(screen.getByRole('img').getAttribute('style')).toContain('foom.png')
  })
})
