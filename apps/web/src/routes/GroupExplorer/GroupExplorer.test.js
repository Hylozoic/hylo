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
