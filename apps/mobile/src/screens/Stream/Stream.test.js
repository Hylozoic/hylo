import 'react-native'
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import { render } from '@testing-library/react-native'
import { TestRoot } from 'util/testing'
import Stream from './Stream'

jest.mock('store/selectors/getCurrentGroupSlug', () => () => 'public')
jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

it('renders correctly if currentUserHasMemberships', () => {
  const group = {
    id: '1'
  }
  const currentUser = {
    id: '2'
  }
  const newPost = () => {}

  const renderer = new ReactShallowRenderer()
  renderer.render(
    <TestRoot>
      <Stream
        group={group}
        currentUser={currentUser}
        currentUserHasMemberships
        navigation={{}}
        route={{}}
        newPost={newPost}
        showPost={() => {}}
        editPost={() => {}}
        goToGroup={() => {}}
        topicName='amazing'
      />
    </TestRoot>
  )
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('renders correctly if currentUserHasMemberships is false', () => {
  const group = {
    id: '1'
  }
  const currentUser = {
    id: '2'
  }
  const newPost = () => {}

  const renderer = new ReactShallowRenderer()
  renderer.render(
    <TestRoot>
      <Stream
        group={group}
        currentUser={currentUser}
        currentUserHasMemberships={false}
        navigation={{}}
        newPost={newPost}
        showPost={() => {}}
        editPost={() => {}}
        goToGroup={() => {}}
        topicName='amazing'
      />
    </TestRoot>
  )
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('calls fetchGroupTopic on componentDidMount', () => {
  const props = {
    navigation: {},
    fetchGroupTopic: jest.fn(),
    showTopic: jest.fn(),
    showMember: jest.fn(),
    goToGroup: jest.fn(),
    setTopicSubscribe: jest.fn(),
    newPost: jest.fn(),
    topicName: 'test-topic'
  }

  const TestStack = createStackNavigator()

  const component = (
    <TestRoot>
      <TestStack.Navigator>
        <TestStack.Screen name='Stream'>
          {screenProps => (
            <Stream {...props} {...screenProps} />
          )}
        </TestStack.Screen>
      </TestStack.Navigator>
    </TestRoot>
  )
  const { toJSON } = render(component)

  expect(toJSON()).toMatchSnapshot()
})
