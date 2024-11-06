import React from 'react'
import { graphql } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import denormalized from './MemberProfile.test.json'
import MemberProfile from './MemberProfile.js'
import orm from 'store/models'

function testWrapper (providedState) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create(denormalized.data.person)
  const reduxState = { orm: ormSession.state, ...providedState }
  return AllTheProviders(reduxState)
}

describe('MemberProfile', () => {
  const defaultTestProps = {
    routeParams: { personId: '1' },
    person: denormalized.data.person,
    fetchPerson: jest.fn(),
    roles: []
  }

  it('renders the member name', () => {
    render(<MemberProfile {...defaultTestProps} />, { wrapper: testWrapper() })
    expect(screen.getByRole('heading', { name: denormalized.data.person.name })).toBeInTheDocument()
  })

  it('displays an error if can\'t find person', () => {
    const props = {
      ...defaultTestProps
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.getByText('That doesn\'t seem to be a valid person ID.')).toBeInTheDocument()
  })

  it('displays bio on the Overview tab', async () => {
    mockGraphqlServer.resetHandlers(
      graphql.query('MemberSkills', (req, res, ctx) => {
        return res(
          ctx.data({
            person: {
              id: '1',
              skills: {
                items: []
              }
            }
          })
        )
      }),
      graphql.query('MemberSkillsToLearn', (req, res, ctx) => {
        return res(
          ctx.data({
            person: {
              id: '1',
              skills: {
                items: [{ id: 1, name: 'skill' }]
              }
            }
          })
        )
      }),
      graphql.query('RecentActivity', (req, res, ctx) => {
        return res(
          ctx.data({
            person: {
              id: '1',
              comments: {
                items: [{
                  id: 1,
                  text: 'hello',
                  creator: { id: 1 },
                  post: { id: 1, title: 'title', createdAt: '2021-04-12T15:00:00.000Z' },
                  attachments: [],
                  createdAt: '2021-04-12T15:00:00.000Z'
                }],
                posts: []
              }
            }
          })
        )
      })
    )

    const props = {
      ...defaultTestProps,
      currentTab: 'Overview',
      person: {
        ...defaultTestProps.person,
        bio: 'WOMBATS'
      }
    }

    render(
      <MemberProfile {...props} />,
      { wrapper: testWrapper() }
    )

    expect(screen.getByText('WOMBATS')).toBeInTheDocument()
  })

  it('does not display bio on other tabs', () => {
    const props = {
      ...defaultTestProps,
      currentTab: 'Reactions',
      bio: 'WOMBATS',
      votes: []
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.queryByText('WOMBATS')).not.toBeInTheDocument()
  })

  it('renders RecentActivity on Overview', () => {
    const props = {
      ...defaultTestProps,
      currentTab: 'Overview'
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.getByText(`${denormalized.data.person.name}s recent activity`)).toBeInTheDocument()
  })

  it('renders MemberPosts on Posts', () => {
    const props = {
      ...defaultTestProps,
      currentTab: 'Posts'
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.getByText(`${denormalized.data.person.name}s posts`)).toBeInTheDocument()
  })

  it('renders MemberComments on Comments', () => {
    const props = {
      ...defaultTestProps,
      currentTab: 'Comments'
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.getByText(`${denormalized.data.person.name}s comments`)).toBeInTheDocument()
  })

  it('renders MemberVotes on reactions', () => {
    const props = {
      ...defaultTestProps,
      currentTab: 'Reactions',
      roles: [{ id: 1, common: true, responsibilities: { items: [{ id: 1, title: 'Manage Content' }] } }]
    }
    render(<MemberProfile {...props} />, { wrapper: testWrapper() })
    expect(screen.getByText(`${denormalized.data.person.name}s reactions`)).toBeInTheDocument()
  })
})
