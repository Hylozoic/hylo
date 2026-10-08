import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import Comment from './Comment'
import { TestRoot } from 'util/testing'

it('renders correctly', () => {
  const comment = {
    id: 1,
    creator: {
      name: 'Ishamel',
      avatarUrl: 'foo.png'
    },
    text: 'tick followed tock followed tick followed tock'
  }

  const style = {
    margin: 12
  }

  const renderer = new ReactShallowRenderer()
  renderer.render(
    <TestRoot>
      <Comment comment={comment} deleteComment={jest.fn()} handleReply={jest.fn()} style={style} />
    </TestRoot>
  )
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('shows the post title when displayPostTitle is true', () => {
  const comment = {
    id: 1,
    creator: {
      name: 'Ishamel',
      avatarUrl: 'foo.png'
    },
    text: 'tick followed tock followed tick followed tock',
    post: {
      id: 23,
      title: "What's good? A long enough post title to be a bit truncated thanks"
    }
  }

  const style = {
    margin: 12
  }

  const renderer = new ReactShallowRenderer()
  renderer.render(
    <TestRoot>
      <Comment comment={comment} style={style} handleReply={jest.fn()} displayPostTitle />
    </TestRoot>
  )
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
