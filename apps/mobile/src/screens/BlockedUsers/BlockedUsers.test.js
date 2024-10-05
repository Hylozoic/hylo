import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import BlockedUsers, { BlockedUserRow } from './BlockedUsers'

describe('BlockedUsers', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const props = {
      blockedUsers: [
        { id: 1, name: 'Blocker User 1' },
        { id: 2, name: 'Blocker User 2' }
      ]
    }

    renderer.render(<BlockedUsers {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
