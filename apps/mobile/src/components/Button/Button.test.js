import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import Button from './Button'

it('matches last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  const props = {
    text: 'Push Me',
    onPress: () => {},
    disabled: false
  }

  renderer.render(<Button {...props} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('disables', () => {
  const renderer = new ReactShallowRenderer()
  const props = {
    text: 'Push Me',
    onPress: () => {},
    disabled: true
  }

  renderer.render(<Button {...props} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
