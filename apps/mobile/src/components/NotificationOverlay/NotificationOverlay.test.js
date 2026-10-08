import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import NotificationOverlay from './NotificationOverlay'

it('matches the last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  renderer.render(<NotificationOverlay message='Consider yourself notified.' />)
  expect(renderer.getRenderOutput()).toMatchSnapshot()
})
