import React from 'react'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { graphql, HttpResponse } from 'msw'
import orm from 'store/models'
import AllTopics from './AllTopics'
import SearchBar from './SearchBar'
import TopicListItem from './TopicListItem'

const mockStore = configureStore([])

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ groupSlug: 'goteam' })
}))

function testProviders () {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })
  ormSession.Topic.create({ id: '1', name: 'petitions', group: { id: '1' } })
  ormSession.Group.create({ id: '1', slug: 'goteam', name: 'goteam' })
  ormSession.GroupTopic.create({ id: '1', topic: { id: '1' }, group: { id: '1' } })
  const reduxState = { orm: ormSession.state }

  return AllTheProviders(reduxState)
}

describe('AllTopics', () => {
  beforeEach(() => {
    mockGraphqlServer.use(
      graphql.query('FetchTopics', ({ query, variables }) => {
        console.log('FetchTopics query', query, variables)
        return HttpResponse.json({
          data: {
            topics: [{ id: '1', name: 'petitions' }]
          }
        })
      })
    )
  })

  it('renders the component with topics', async () => {

    render(
      <AllTopics
        toggleGroupTopicSubscribe={() => {}}
      />,
      { wrapper: testProviders() }
    )

    await waitFor(() => {
      expect(screen.getByText('goteam Topics')).toBeInTheDocument()
      // TODO: fix this
      // expect(screen.getByText('#petitions')).toBeInTheDocument()
    })
  })
})

describe('SearchBar', () => {
  it('renders search input and sort dropdown', () => {
    const props = {
      search: 'test',
      setSearch: jest.fn(),
      selectedSort: 'num_followers',
      setSort: jest.fn(),
      fetchIsPending: false
    }

    render(<SearchBar {...props} />)

    expect(screen.getByPlaceholderText('Search topics')).toHaveValue('test')
    expect(screen.getByText('Popular')).toBeInTheDocument()
  })

  it('calls setSearch when input changes', () => {
    const setSearch = jest.fn()
    const props = {
      search: '',
      setSearch,
      selectedSort: 'num_followers',
      setSort: jest.fn(),
      fetchIsPending: false
    }

    render(<SearchBar {...props} />)

    fireEvent.change(screen.getByPlaceholderText('Search topics'), { target: { value: 'new search' } })
    expect(setSearch).toHaveBeenCalledWith('new search')
  })
})

describe('TopicListItem', () => {
  it('renders topic information for multiple groups', () => {
    const topic = {
      name: 'petitions',
      groupTopics: [
        {
          id: '1',
          postsTotal: 24,
          followersTotal: 52,
          isSubscribed: false,
          group: { id: '1', name: 'Group 1' }
        },
        {
          id: '2',
          postsTotal: 1,
          followersTotal: 4,
          isSubscribed: true,
          group: { id: '2', name: 'Group 2' }
        }
      ]
    }

    render(
      <TopicListItem
        topic={topic}
        routeParams={{ groupSlug: 'goteam' }}
      />
    )

    expect(screen.getByText('#petitions')).toBeInTheDocument()
    expect(screen.getByText('Group 1')).toBeInTheDocument()
    expect(screen.getByText('Group 2')).toBeInTheDocument()
    expect(screen.getByText(/24 posts/)).toBeInTheDocument()
    expect(screen.getByText(/52 subscribers/)).toBeInTheDocument()
    expect(screen.getByText(/1 post/)).toBeInTheDocument()
    expect(screen.getByText(/4 subscribers/)).toBeInTheDocument()
  })
})
