import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { Provider } from 'react-redux'
import configureStore from 'redux-mock-store'
import AllTopics, { SearchBar, TopicListItem } from './AllTopics'

const mockStore = configureStore([])

describe('AllTopics', () => {
  it('renders the component with topics', async () => {
    const store = mockStore({
      // Add necessary mock state here
    })

    const topic = [
      {
        id: '1',
        name: 'petitions',
        postsTotal: 24,
        followersTotal: 52,
        isSubscribed: false
      }
    ]

    render(
      <Provider store={store}>
        <AllTopics
          group={{ id: '1', slug: 'goteam' }}
          routeParams={{ groupSlug: 'goteam' }}
          topics={topic}
          topicsTotal='10'
          fetchTopics={jest.fn()}
          toggleGroupTopicSubscribe={() => {}}
        />
      </Provider>
    )

    expect(screen.getByText('goteam Topics')).toBeInTheDocument()
    expect(screen.getByText('#petitions')).toBeInTheDocument()
  })

  it('caches totalTopics', async () => {
    const store = mockStore({
      // Add necessary mock state here
    })

    const { rerender } = render(
      <Provider store={store}>
        <AllTopics
          routeParams={{ groupSlug: 'goteam' }}
          group={{ id: '1', slug: 'goteam' }}
          fetchTopics={() => {}}
          toggleGroupTopicSubscribe={() => {}}
          topics={[]}
          selectedSort='followers'
        />
      </Provider>
    )

    expect(screen.queryByText('11 Total Topics')).not.toBeInTheDocument()

    rerender(
      <Provider store={store}>
        <AllTopics
          routeParams={{ groupSlug: 'goteam' }}
          group={{ id: '1', slug: 'goteam' }}
          fetchTopics={() => {}}
          toggleGroupTopicSubscribe={() => {}}
          topics={[]}
          selectedSort='followers'
          totalTopics={11}
        />
      </Provider>
    )

    await waitFor(() => {
      expect(screen.getByText('11 Total Topics')).toBeInTheDocument()
    })

    rerender(
      <Provider store={store}>
        <AllTopics
          routeParams={{ groupSlug: 'goteam' }}
          group={{ id: '1', slug: 'goteam' }}
          fetchTopics={() => {}}
          toggleGroupTopicSubscribe={() => {}}
          topics={[]}
          selectedSort='followers'
          totalTopics={5}
        />
      </Provider>
    )

    expect(screen.getByText('11 Total Topics')).toBeInTheDocument()
  })
})

describe('SearchBar', () => {
  it('renders search input and sort dropdown', () => {
    const props = {
      search: 'test',
      setSearch: jest.fn(),
      selectedSort: 'followers',
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
      selectedSort: 'followers',
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
    expect(screen.getByText('24 posts')).toBeInTheDocument()
    expect(screen.getByText('52 subscribers')).toBeInTheDocument()
    expect(screen.getByText('1 post')).toBeInTheDocument()
    expect(screen.getByText('4 subscribers')).toBeInTheDocument()
  })
})
