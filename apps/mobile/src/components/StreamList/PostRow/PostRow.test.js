import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import { TestRoot } from 'util/testing'
import PostRow from './PostRow'

jest.mock('react-native-share', () => ({
  default: jest.fn()
}))

describe('PostRow', () => {
  it('renders correctly', () => {
    const post = {
      id: 1
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <TestRoot>
        <PostRow
          post={post}
          navigate={() => {}}
          goToGroup={() => {}}
        />
      </TestRoot>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

