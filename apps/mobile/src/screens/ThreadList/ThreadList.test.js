import React from 'react'
import TestRenderer from 'react-test-renderer'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import { ThreadList } from './ThreadList'

describe('ThreadList', () => {
  it('renders correctly', () => {
    const threads = [{ id: 1, participants: [{ id: 1, avatarUrl: 'blah' }], lastMessage: { id: 1 } }]
    const renderer = TestRenderer.create(<ThreadList isFocused threads={threads} updateLastViewed={jest.fn()} />)

    expect(renderer.toJSON()).toMatchSnapshot()
  })

  it('fetches threads initially when empty', () => {
    const fetchThreads = jest.fn()
    const renderer = TestRenderer.create(
      <ThreadList
        t={str => str}
        fetchThreads={fetchThreads}
        hasMore
        isFocused
        updateLastViewed={jest.fn()}
        pending={false}
        threads={[]}
      />
    )
    expect(fetchThreads).toHaveBeenCalled()
    renderer.getInstance().setState({ ready: true })
    expect(renderer.toJSON()).toMatchSnapshot()
  })

  it('handles pending correctly without threads', () => {
    const renderer = new ReactShallowRenderer()
    const threads = []
    renderer.render(<ThreadList t={str => str} threads={threads} updateLastViewed={jest.fn()} isFocused pending />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('handles pending correctly with threads', () => {
    const renderer = TestRenderer.create(
      <ThreadList
        t={str => str}
        fetchThreads={() => {}}
        isFocused
        updateLastViewed={jest.fn()}
        pending
        threads={[{ id: 1 }]}
      />
    )
    expect(renderer.toJSON()).toMatchSnapshot()
  })

  it('handles when there are no threads correctly', () => {
    const renderer = TestRenderer.create(
      <ThreadList
        t={str => str}
        fetchThreads={() => {}}
        isFocused
        updateLastViewed={jest.fn()}
        pending={false}
        threads={[]}
      />
    )
    renderer.getInstance().setState({ ready: true })
    expect(renderer.toJSON()).toMatchSnapshot()
  })
})
