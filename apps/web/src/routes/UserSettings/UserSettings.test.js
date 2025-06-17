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
      name: 'Test User',
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
      }),
      graphql.query('UserSettingsQuery', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              affiliations: {
                items: []
              },
              blockedUsers: [
                {
                  id: '2',
                  name: 'a user'
                }
              ],
              memberships: [
                {
                  id: '2',
                  group: {
                    id: '1',
                    name: 'Wombats',
                    chatRooms: {
                      items: []
                    }
                  }
                },
                {
                  id: '3',
                  group: {
                    id: '2',
                    name: 'Beavers',
                    chatRooms: {
                      items: []
                    }
                  }
                }
              ]
            }
          }
        })
      }),
      graphql.query('fetchUserSettings', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              name: 'Test User',
              avatarUrl: null,
              bannerUrl: null,
              bio: '',
              tagline: '',
              location: null,
              settings: {}
            }
          }
        })
      }),
      graphql.mutation('updateMe', () => {
        return HttpResponse.json({
          data: {
            updateMe: {
              id: '1'
            }
          }
        })
      }),
      graphql.query('savedSearches', () => {
        return HttpResponse.json({
          data: {
            savedSearches: {
              total: 0,
              hasMore: false,
              items: []
            }
          }
        })
      }),
      graphql.query('fetchMyInvitesAndRequests', () => {
        return HttpResponse.json({
          data: {
            me: {
              id: '1',
              groupInvites: [],
              pendingGroupRequests: []
            }
          }
        })
      })
    )
  })

  it('renders correctly', async () => {
    render(
      <UserSettings />,
      { 
        wrapper: AllTheProviders(reduxState, ['/edit-profile']),
        route: '/edit-profile'
      }
    )

    // Check if main sections are rendered
    await waitFor(() => {
      expect(screen.getByText('Banner and Avatar Images')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Tagline')).toBeInTheDocument()
      expect(screen.getByText('About Me')).toBeInTheDocument()
      expect(screen.getByText('Location')).toBeInTheDocument()
      expect(screen.getByText('Website')).toBeInTheDocument()
      expect(screen.getByText('My Skills & Interests')).toBeInTheDocument()
      expect(screen.getByText('Add a Skill or Interest')).toBeInTheDocument()
      expect(screen.getByText('What I\'m learning')).toBeInTheDocument()
      expect(screen.getByText('Add a skill you want to learn')).toBeInTheDocument()
      expect(screen.getByText('Contact Email')).toBeInTheDocument()
      expect(screen.getByText('Contact Phone')).toBeInTheDocument()
      expect(screen.getByText('Social Accounts')).toBeInTheDocument()
      expect(screen.getByText('Facebook')).toBeInTheDocument()
      expect(screen.getByText('Twitter')).toBeInTheDocument()
      expect(screen.getByText('LinkedIn')).toBeInTheDocument()      
    })
  })
})
