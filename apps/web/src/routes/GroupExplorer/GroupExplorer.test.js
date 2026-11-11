import React from 'react'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { render, AllTheProviders, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupExplorer from './GroupExplorer'
import userEvent from '@testing-library/user-event'
import orm from 'store/models'

jest.mock('components/ScrollListener', () => () => <div />) // was throwing errors with this.element().removeEventListener('blabadlbakdbfl')

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

afterEach(() => {
  mockGraphqlServer.resetHandlers()
  // useLocation is mocked for every test (config/jest/beforeTestEnvSetup.js)
  require('react-router-dom').useLocation.mockReturnValue({ pathname: '', search: '' })
})

// Disable API mocking after the tests are done.
afterAll(() => mockGraphqlServer.close())

test('GroupExplorer integration test', async () => {
  mockGraphqlServer.resetHandlers(
    graphql.query('FetchGroups', ({ query, variables }) => {
      const { search, groupType } = variables
      let items
      if (search === '') {
        items = firstGroupResults
      } else if (search === 'different group' && !groupType) {
        items = secondGroupResults
      }
      return HttpResponse.json({
        data: {
          groups: { hasMore: false, items, total: 0 }
        }
      })
    })
  )
  const user = userEvent.setup()

  render(
    <GroupExplorer />,
    { wrapper: testProviders() }
  )

  expect(await screen.findByText('Test Group Title')).toBeInTheDocument()
  expect(screen.queryByText('Search input results')).not.toBeInTheDocument()

  await user.type(screen.getByRole('textbox'), 'different group')
  expect(await screen.findByText('Search input results')).toBeInTheDocument()
  expect(screen.queryByText('Farms')).not.toBeInTheDocument()
  expect(screen.queryByText('All Groups')).not.toBeInTheDocument()
  expect(screen.getByText(/Sort by/)).toBeInTheDocument()
})

test('sorts by Recently active by default', async () => {
  const requests = []
  mockGraphqlServer.resetHandlers(
    graphql.query('FetchGroups', ({ variables }) => {
      requests.push(variables)
      return HttpResponse.json({
        data: { groups: { hasMore: false, items: variables.search === '' ? firstGroupResults : [], total: 0 } }
      })
    })
  )

  render(<GroupExplorer />, { wrapper: testProviders() })

  expect(await screen.findByText('Test Group Title', {}, { timeout: 10000 })).toBeInTheDocument()
  expect(screen.getByText('Recently active')).toBeInTheDocument()
  const searchRequest = requests.find(v => v.search === '')
  expect(searchRequest.sortBy).toBe('recent')
}, 30000)

test('starts with the search term from ?search=', async () => {
  const requests = []
  mockGraphqlServer.resetHandlers(
    graphql.query('FetchGroups', ({ variables }) => {
      requests.push(variables)
      return HttpResponse.json({
        data: { groups: { hasMore: false, items: variables.search === 'different group' ? secondGroupResults : [], total: 0 } }
      })
    })
  )

  const { useLocation } = require('react-router-dom')
  useLocation.mockReturnValue({ pathname: '/public/groups', search: '?search=different%20group' })

  render(<GroupExplorer />, { wrapper: testProviders() })

  expect(await screen.findByText('Search input results', {}, { timeout: 10000 })).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('different group')
  expect(requests.some(v => v.search === 'different group')).toBe(true)
}, 30000)

const firstGroupResults = [
  {
    accessibility: [3],
    memberCount: 12,
    description: 'Words do not belong in this here town',
    location: 'Baltimore',
    locationObject: {
      city: 'Baltimore',
      country: 'USA',
      fullText: 'Baltimore, USA',
      locality: '',
      neighborhood: '',
      region: 'East Coast'
    },
    id: '345',
    avatarUrl: 'wee.com',
    bannerUrl: 'wee.com',
    name: 'Test Group Title',
    slug: 'test-group-title',
    groupTopics: [],
    members: []
  }
]

const secondGroupResults = [
  {
    accessibility: [3],
    memberCount: 16,
    description: 'Completely different group don\'t you think',
    location: 'Somewhere else',
    locationObject: {
      city: 'Austin',
      country: 'USA',
      fullText: 'Austin, USA',
      locality: '',
      neighborhood: '',
      region: 'East Coast'
    },
    id: '345',
    avatarUrl: 'wee.com',
    bannerUrl: 'wee.com',
    name: 'Search input results',
    slug: 'test-group-title',
    groupTopics: [],
    members: []
  }
]
