import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import { HeaderRightButton } from './ModalHeader'

jest.mock('util/platform', () => ({ isIOS: true }))

describe('HeaderRightButton', () => {
  const defaultProps = {
    text: 'Press Me!',
    onPress: () => {},
    disabled: false
  }

  it('matches last snapshot', () => {
    const renderer = new ReactShallowRenderer()

    renderer.render(<HeaderRightButton {...defaultProps} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
