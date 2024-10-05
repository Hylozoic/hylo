import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import StreamList from './StreamList'
import { TestRoot } from 'util/testing'

jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

describe('StreamList', () => {
  it('renders correctly', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <TestRoot>
        <StreamList
          postIds={[1, 2, 3]}
          filter='all'
          sortBy='latest'
          setFilter={() => {}}
          setSort={() => {}}
          fetchMorePosts={() => {}}
          pending
          refreshPosts={() => {}}
        />
      </TestRoot>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
