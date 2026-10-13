import 'react-native'
import React from 'react'
import ShallowRenderer from 'react-test-renderer/shallow'
import TestRenderer from 'react-test-renderer'

import BadgedIcon from './'
import Icon from 'components/Icon'
import { simulate } from 'util/testing'

describe('BadgedIcon', () => {
  it('matches the last snapshot without the badge', () => {
    const renderer = new ShallowRenderer()
    renderer.render(<BadgedIcon name='Notifications' onPress={() => {}} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot with the badge', () => {
    const renderer = new ShallowRenderer()
    renderer.render(<BadgedIcon name='Notifications' onPress={() => {}} showBadge />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('calls the onPress passed to the wrapped component', async () => {
    const onPress = jest.fn()
    const root = TestRenderer.create(<BadgedIcon onPress={onPress} />).root
    simulate(await root.findByType(Icon), 'press')
    expect(onPress).toHaveBeenCalled()
  })
})
