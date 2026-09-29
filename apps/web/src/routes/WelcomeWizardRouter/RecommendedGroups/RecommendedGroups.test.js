import React from 'react'
import { graphql, HttpResponse } from 'msw'
import userEvent from '@testing-library/user-event'
import { push, replace } from 'redux-first-history'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import orm from 'store/models'
import { AllTheProviders, render, screen, waitFor, within } from 'util/testing/reactTestingLibraryExtended'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'
import RecommendedGroups, { needsAboutPage } from './RecommendedGroups'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))
jest.mock('redux-first-history', () => ({
  ...jest.requireActual('redux-first-history'),
  push: jest.fn(path => ({ type: 'TEST_PUSH', payload: path })),
  replace: jest.fn(path => ({ type: 'TEST_REPLACE', payload: path }))
}))

const recommended = attrs => ({
  id: '11',
  name: 'Garden Circle',
  slug: 'garden-circle',
  avatarUrl: null,
  description: 'We grow things together',
  location: 'Bellingham',
  memberCount: 14,
  settings: { askJoinQuestions: false },
  agreements: { items: [] },
  joinQuestions: { items: [] },
  ...attrs
})

function providers () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1', name: 'New Person' })
  return AllTheProviders({ orm: ormSession.state })
}

function mockApi (groups, joins = []) {
  mockGraphqlServer.resetHandlers(
    graphql.operation(({ query, variables }) => {
      if (query.includes('recommendedGroups')) {
        return HttpResponse.json({ data: { recommendedGroups: groups } })
      }
      if (query.includes('joinGroup')) {
        joins.push(variables)
        return HttpResponse.json({
          data: {
            joinGroup: {
              id: 'm1',
              group: { id: variables.groupId, name: 'Garden Circle', slug: 'garden-circle' },
              person: { id: '1' },
              lastViewedAt: null,
              settings: { agreementsAcceptedAt: null, joinQuestionsAnsweredAt: null, showJoinForm: true }
            }
          }
        })
      }
      return HttpResponse.json({ data: {} })
    })
  )
}

afterEach(() => {
  mockGraphqlServer.resetHandlers()
  trackAnalyticsEvent.mockClear()
  push.mockClear()
  replace.mockClear()
})
afterAll(() => mockGraphqlServer.close())

describe('needsAboutPage', () => {
  it('sends groups with agreements or join questions to their About page', () => {
    expect(needsAboutPage(recommended())).toBe(false)
    expect(needsAboutPage(recommended({ agreements: { items: [{ id: '1' }] } }))).toBe(true)
    expect(needsAboutPage(recommended({ settings: { askJoinQuestions: true }, joinQuestions: { items: [{ id: '2' }] } }))).toBe(true)
    // Questions that aren't switched on don't count
    expect(needsAboutPage(recommended({ settings: { askJoinQuestions: false }, joinQuestions: { items: [{ id: '2' }] } }))).toBe(false)
  })
})

describe('RecommendedGroups', () => {
  it('joins a group with one tap', async () => {
    const joins = []
    mockApi([recommended(), recommended({ id: '12', name: 'Pond Watchers', slug: 'pond' })], joins)
    const user = userEvent.setup()

    render(<RecommendedGroups />, { wrapper: providers() })

    const card = (await screen.findByText('Garden Circle', {}, { timeout: 10000 })).closest('li')
    expect(within(card).getByText(/14 members/)).toBeInTheDocument()
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Viewed', { step: 'recommended-groups', groupCount: 2, hasLocation: false })

    await user.click(within(card).getByRole('button', { name: 'Join' }))

    expect(await within(card).findByRole('link', { name: 'Open' }, { timeout: 10000 })).toHaveAttribute('href', '/groups/garden-circle')
    expect(joins).toEqual([{ groupId: '11', questionAnswers: [], acceptAgreements: false }])
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Recommended Group Joined', { groupId: '11', position: 1, hasLocation: false })

    await user.click(screen.getByText('Continue'))
    expect(push).toHaveBeenCalledWith('/welcome/explore')
  }, 30000)

  it('links to the About page for groups with agreements or join questions', async () => {
    mockApi([recommended({ agreements: { items: [{ id: '5' }] } })])

    render(<RecommendedGroups />, { wrapper: providers() })

    const card = (await screen.findByText('Garden Circle', {}, { timeout: 10000 })).closest('li')
    expect(within(card).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/groups/garden-circle/about')
    expect(within(card).queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
  }, 30000)

  it('counts moving on without joining as skipping the step', async () => {
    mockApi([recommended()])
    const user = userEvent.setup()

    render(<RecommendedGroups />, { wrapper: providers() })

    await screen.findByText('Garden Circle', {}, { timeout: 10000 })
    await user.click(screen.getByText('Skip for now'))

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Welcome Wizard Step Skipped', { step: 'recommended-groups' })
    expect(push).toHaveBeenCalledWith('/welcome/explore')
  }, 30000)

  it('goes straight on to the next step when there is nothing to recommend', async () => {
    mockApi([])

    render(<RecommendedGroups />, { wrapper: providers() })

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/welcome/explore'), { timeout: 10000 })
    expect(screen.queryByTestId('recommended-groups')).not.toBeInTheDocument()
  }, 30000)
})
