import React from 'react'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import orm from 'store/models'
import UserSettings from './UserSettings'

describe('UserSettings', () => {
  let ormSession, reduxState, currentUser

  beforeAll(() => {
    ormSession = orm.session(orm.getEmptyState())

    const blockedPerson = ormSession.Person.create({
      id: '2',
      name: 'a user'
    })
    currentUser = ormSession.Me.create({
      id: '1',
      hasFeature: () => true,
      blockedUsers: ['2'],
      settings: {}
    })
    const group = ormSession.Group.create({
      id: '1',
      name: 'Wombats',
      slug: 'wombats'
    })
    const group2 = ormSession.Group.create({
      id: '2',
      name: 'Beavers',
      slug: 'beavers'
    })
    const memberships = [
      ormSession.Membership.create({
        id: '2',
        settings: {},
        person: currentUser,
        group
      }),
      ormSession.Membership.create({
        id: '3',
        settings: {},
        person: currentUser,
        group: group2
      })
    ]

    reduxState = {
      orm: ormSession.state,
      FullPageModal: { confirm: false },
      pending: { FETCH_FOR_CURRENT_USER: false }
    }
  })

  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('MemberSkills', () => {
        return HttpResponse.json({
          data: {
            person: {
              id: '1',
              skills: {
                items: []
              }
            }
          }
        })
      }),
      graphql.query('MemberSkillsToLearn', () => {
        return HttpResponse.json({
          data: {
            person: {
              id: '1',
              skills: {
                items: [{ id: 1, name: 'skill' }]
              }
            }
          }
        })
      })
    )
  })

  it('renders correctly', async () => {
    render(
      <UserSettings />,
      { wrapper: AllTheProviders(reduxState) }
    )

    // Check if main sections are rendered
    await waitFor(() => {
      expect(screen.getByText('Edit Profile')).toBeInTheDocument()
      expect(screen.getByText('Groups & Affiliations')).toBeInTheDocument()
      expect(screen.getByText('Invites & Requests')).toBeInTheDocument()
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('Account')).toBeInTheDocument()
      expect(screen.getByText('Saved Searches')).toBeInTheDocument()
      expect(screen.getByText('Blocked Users')).toBeInTheDocument()
    })
  })

  // TODO: Fix this test, cant get it to update the redux state
  it.skip('does not render Blocked Users tab when user has no blocked users', async() => {
    // Update the currentUser to have no blocked users
    ormSession.Me.withId('1').update({ blockedUsers: [] })

    render(
      <UserSettings />,
      { wrapper: AllTheProviders({
          orm: ormSession.state,
          FullPageModal: { confirm: false },
          pending: { FETCH_FOR_CURRENT_USER: false }
        })
      }
    )

    await waitFor(() => {
      expect(screen.queryByText('Blocked Users')).not.toBeInTheDocument()
    })
  })

})
