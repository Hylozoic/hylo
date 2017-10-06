import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import TestRenderer from 'react-test-renderer'
import Feed from './Feed'
import { Provider } from 'react-redux'
import orm from 'store/models'

it('renders correctly', () => {
  const community = {
    id: '1'
  }
  const currentUser = {
    id: '2'
  }
  const newPost = () => {}

  const renderer = new ReactShallowRenderer()
  renderer.render(<Feed
    community={community}
    currentUser={currentUser}
    newPost={newPost}
    showPost={() => {}}
    editPost={() => {}}
    goToCommunity={() => {}}
    topicName={'amazing'} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('sets the title if there is a topic', () => {
  const navigation = {
    state: {
      params: {
        topicName: 'math'
      }
    }
  }

  expect(Feed.navigationOptions({ navigation })).toEqual({
    headerTitle: '#math'
  })
})

it('calls fetchCommunityTopic on componentDidMount', () => {
  const fetchCommunityTopic = jest.fn()
  const state = {
    orm: orm.getEmptyState(),
    FeedList: {},
    queryResults: {},
    pending: {}
  }
  const mockStore = {
    subscribe: jest.fn(),
    getState: jest.fn(() => state),
    dispatch: jest.fn()
  }

  const renderer = TestRenderer.create(
    <Provider store={mockStore}>
      <Feed fetchCommunityTopic={fetchCommunityTopic} />
    </Provider>
  )

  const feed = renderer.root.findByType(Feed).instance
  feed.componentDidMount()
  expect(fetchCommunityTopic).toBeCalled()
})
