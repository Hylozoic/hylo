import React from 'react'
import userEvent from '@testing-library/user-event'
import { graphql, HttpResponse } from 'msw'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import GroupWelcomeModal from './GroupWelcomeModal'
import * as reactRouterDom from 'react-router-dom'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))

it('selects group and displays agreements', async () => {
  const testGroup = {
    id: '1',
    name: 'Test Group',
    slug: 'test-group',
    bannerUrl: 'anything',
    settings: {
      showSuggestedSkills: true
    }
  }
  const testMembership = {
    id: '1',
    person: { id: '1' },
    settings: {
      showJoinForm: true
    },
    group: testGroup
  }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    const reduxState = { orm: ormSession.state }

    extractModelsForTest({
      me: {
        id: '1',
        memberships: {
          items: [testMembership]
        }
      }
    }, 'Me', ormSession)

    extractModelsForTest({
      groups: [testGroup]
    }, 'Group', ormSession)

    return AllTheProviders(reduxState)
  }

  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id,
            agreements: {
              items: [{ id: 1, description: 'Do good stuff always', title: 'Be cool' }]
            },
            suggestedSkills: {
              items: [
                { id: '1', name: 'a-skill-to-have' }
              ]
            }
          }
        }
      })
    }),
    graphql.mutation('UpdateMembershipSettings', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id
          }
        }
      })
    })
  )

  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })

  const { container } = render(
    <GroupWelcomeModal />,
    { wrapper: testProviders() }
  )

  await waitFor(() => {
    expect(
      screen.queryByText('Do good stuff always') || container.querySelector('#root')
    ).toBeTruthy()
  })
})

it('does not re-show agreements and join questions that were already completed', async () => {
  const testGroup = {
    id: '2',
    name: 'Already Joined Group',
    slug: 'already-joined-group',
    bannerUrl: 'anything',
    settings: {
      askJoinQuestions: true,
      agreementsLastUpdatedAt: '2020-01-01T00:00:00.000Z'
    },
    agreements: [{ id: '21', description: 'Do good stuff always', title: 'Be cool' }],
    joinQuestions: [{ id: '21', questionId: '210', text: 'Why do you want to join?' }]
  }
  const testMembership = {
    id: '2',
    person: { id: '1' },
    settings: {
      showJoinForm: true,
      agreementsAcceptedAt: '2021-06-01T00:00:00.000Z',
      joinQuestionsAnsweredAt: '2021-06-01T00:00:00.000Z'
    },
    agreements: [{ id: '21', accepted: true }],
    group: testGroup
  }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    const reduxState = { orm: ormSession.state }

    extractModelsForTest({
      me: {
        id: '1',
        memberships: {
          items: [testMembership]
        }
      }
    }, 'Me', ormSession)

    extractModelsForTest({
      groups: [testGroup]
    }, 'Group', ormSession)

    return AllTheProviders(reduxState)
  }

  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id,
            settings: testGroup.settings,
            agreements: {
              items: [{ id: '21', description: 'Do good stuff always', title: 'Be cool' }]
            },
            joinQuestions: {
              items: [{ id: '21', questionId: '210', text: 'Why do you want to join?' }]
            }
          }
        }
      })
    })
  )

  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })

  render(
    <GroupWelcomeModal />,
    { wrapper: testProviders() }
  )

  await waitFor(() => {
    expect(screen.getByTestId('group-welcome-modal')).toBeTruthy()
  })

  expect(screen.queryByText('Do good stuff always')).toBeNull()
  expect(screen.queryByText('Why do you want to join?')).toBeNull()
  expect(screen.getByTestId('jump-in')).toBeTruthy()
})

it('tracks Group Welcome Completed when the member jumps in', async () => {
  const user = userEvent.setup()
  const testGroup = {
    id: '3',
    name: 'Questions Group',
    slug: 'questions-group',
    bannerUrl: 'anything',
    settings: {
      askJoinQuestions: true
    },
    joinQuestions: [{ id: '31', questionId: '310', text: 'What brings you here?' }]
  }
  const testMembership = {
    id: '3',
    person: { id: '1' },
    settings: {
      showJoinForm: true
    },
    group: testGroup
  }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    const reduxState = { orm: ormSession.state }

    extractModelsForTest({
      me: {
        id: '1',
        memberships: {
          items: [testMembership]
        }
      }
    }, 'Me', ormSession)

    extractModelsForTest({
      groups: [testGroup]
    }, 'Group', ormSession)

    return AllTheProviders(reduxState)
  }

  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id,
            settings: testGroup.settings,
            joinQuestions: {
              items: [{ id: '31', questionId: '310', text: 'What brings you here?' }]
            }
          }
        }
      })
    }),
    graphql.mutation('UpdateMembershipSettings', () => {
      return HttpResponse.json({
        data: {
          updateMembership: {
            id: testMembership.id
          }
        }
      })
    })
  )

  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })

  render(
    <GroupWelcomeModal />,
    { wrapper: testProviders() }
  )

  await user.type(await screen.findByPlaceholderText('Type your answer here...'), 'Good company')
  await user.click(screen.getByTestId('jump-in'))

  await waitFor(() => {
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Group Welcome Completed', {
      groupId: '3',
      hadAgreements: false,
      hadJoinQuestions: true
    })
  })
})

it('does not track Group Welcome Completed when an existing member re-accepts changed agreements', async () => {
  trackAnalyticsEvent.mockClear()
  const user = userEvent.setup()
  const testGroup = {
    id: '4',
    name: 'Changed Agreements Group',
    slug: 'changed-agreements-group',
    bannerUrl: 'anything',
    settings: {
      agreementsLastUpdatedAt: '2022-01-01T00:00:00.000Z'
    },
    agreements: [{ id: '41', description: 'Be kind to each other', title: 'Kindness' }]
  }
  const testMembership = {
    id: '4',
    person: { id: '1' },
    settings: {
      showJoinForm: false,
      agreementsAcceptedAt: '2021-06-01T00:00:00.000Z',
      joinQuestionsAnsweredAt: '2021-06-01T00:00:00.000Z'
    },
    group: testGroup
  }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    const reduxState = { orm: ormSession.state }

    extractModelsForTest({
      me: {
        id: '1',
        memberships: {
          items: [testMembership]
        }
      }
    }, 'Me', ormSession)

    extractModelsForTest({
      groups: [testGroup]
    }, 'Group', ormSession)

    return AllTheProviders(reduxState)
  }

  let membershipUpdated = false
  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => {
      return HttpResponse.json({
        data: {
          group: {
            id: testGroup.id,
            settings: testGroup.settings,
            agreements: {
              items: [{ id: '41', description: 'Be kind to each other', title: 'Kindness' }]
            }
          }
        }
      })
    }),
    graphql.mutation('UpdateMembershipSettings', () => {
      membershipUpdated = true
      return HttpResponse.json({
        data: {
          updateMembership: {
            id: testMembership.id
          }
        }
      })
    })
  )

  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })

  render(
    <GroupWelcomeModal />,
    { wrapper: testProviders() }
  )

  expect(await screen.findByText('The agreements have changed since you last accepted them. Please review and accept them again.')).toBeInTheDocument()
  await user.click(screen.getByTestId('cbAgreement0'))
  await user.click(screen.getByTestId('jump-in'))

  await waitFor(() => expect(membershipUpdated).toBe(true))
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Group Welcome Completed', expect.anything())
})

it('offers Introduce yourself on the last step, and opens the composer with the template after jumping in', async () => {
  const user = userEvent.setup()
  const testGroup = { id: '5', name: 'Intro Group', slug: 'intro-group', bannerUrl: 'anything', settings: {} }
  const testMembership = { id: '5', person: { id: '1' }, settings: { showJoinForm: true }, group: testGroup }

  function testProviders () {
    const ormSession = orm.mutableSession(orm.getEmptyState())
    extractModelsForTest({ me: { id: '1', memberships: { items: [testMembership] } } }, 'Me', ormSession)
    extractModelsForTest({ groups: [testGroup] }, 'Group', ormSession)
    return AllTheProviders({ orm: ormSession.state })
  }

  let membershipSaved = false
  mockGraphqlServer.use(
    graphql.query('GroupWelcomeQuery', () => HttpResponse.json({ data: { group: { id: testGroup.id } } })),
    graphql.mutation('UpdateMembershipSettings', () => {
      membershipSaved = true
      return HttpResponse.json({ data: { updateMembership: { id: testMembership.id } } })
    })
  )
  jest.spyOn(reactRouterDom, 'useParams').mockReturnValue({ groupSlug: testGroup.slug })
  reactRouterDom.useLocation.mockReturnValue({ pathname: '/groups/intro-group/stream', search: '' })

  render(<GroupWelcomeModal />, { wrapper: testProviders() })

  await user.click(await screen.findByTestId('welcome-introduce-yourself'))

  await waitFor(() => expect(membershipSaved).toBe(true))
  await waitFor(() => expect(new URL(window.location.href).searchParams.get('template')).toBe('intro'))
  const opened = new URL(window.location.href)
  expect(opened.pathname).toBe('/groups/intro-group/stream')
  expect(opened.searchParams.get('newPostType')).toBe('discussion')
  expect(opened.searchParams.get('composerEntry')).toBe('welcome')
  reactRouterDom.useLocation.mockReturnValue({ pathname: '', search: '' })
})
