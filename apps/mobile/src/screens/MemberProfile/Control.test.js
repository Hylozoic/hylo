import React from 'react'
import 'react-native'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import Control from './Control'

describe('Control', () => {
  it('matches the last snapshot', () => {
    const props = {
      value: 'a',
      placeholder: 'b',
      onChangeTest: () => {},
      editable: true,
      onBlur: () => {},
      multiline: true,
      hideEditIcon: false,
      isMe: true
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(<Control {...props} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
