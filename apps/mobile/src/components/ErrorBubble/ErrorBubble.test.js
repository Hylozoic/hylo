import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ErrorBubble from './ErrorBubble'

it('matches last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  const props = {
    text: 'Some error message'
  }

  renderer.render(<ErrorBubble {...props} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
