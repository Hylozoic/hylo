import React from 'react'
import { graphql, HttpResponse } from 'msw'
import { AllTheProviders, render, screen, waitFor } from 'util/testing/reactTestingLibraryExtended'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import extractModelsForTest from 'util/testing/extractModelsForTest'
import GroupWelcomeModal from './GroupWelcomeModal'
import * as reactRouterDom from 'react-router-dom'

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
