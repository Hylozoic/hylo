import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ItemChooserItemRow from './ItemChooserItemRow'

it('renders as expected', () => {
  const props = {
    item: { id: 1 },
    onPress: () => {}
  }
  const renderer = new ReactShallowRenderer()
  renderer.render(<ItemChooserItemRow {...props} />)
  expect(renderer.getRenderOutput()).toMatchSnapshot()
})
