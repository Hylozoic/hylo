import 'react-native'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'

import Badge from './'

describe('BadgedIcon', () => {
  it('returns null when count is zero', () => {
    const renderer = new ShallowRenderer()
    renderer.render(<Badge count={0} />)
    expect(renderer.getRenderOutput()).toEqual(null)
  })

  it('matches snapshot when count is not zero', () => {
    const renderer = new ShallowRenderer()
    renderer.render(<Badge count={7} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })
})
