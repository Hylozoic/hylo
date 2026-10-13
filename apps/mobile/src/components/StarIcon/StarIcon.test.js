import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import StarIcon from './StarIcon'

describe('StarIcon', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<StarIcon />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
