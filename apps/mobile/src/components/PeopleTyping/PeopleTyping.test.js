import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'

import PeopleTyping from './PeopleTyping'

it('matches the last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  renderer.render(<PeopleTyping addUserTyping={() => {}} clearUserTyping={() => {}} />)
  expect(renderer.getRenderOutput()).toMatchSnapshot()
})
