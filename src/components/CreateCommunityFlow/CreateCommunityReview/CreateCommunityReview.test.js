import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import CreateCommunityReview from './CreateCommunityReview'

jest.mock('../../KeyboardFriendlyView', () => 'KeyboardFriendlyView')
jest.mock('react-native-device-info')

it('matches last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  const props = {}

  renderer.render(<CreateCommunityReview {...props} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
