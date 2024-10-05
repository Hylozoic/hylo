import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import PersonPickerItemRow from './PersonPickerItemRow'

it('renders as expected', () => {
  const props = {
    item: { id: 1 },
    onPress: () => {}
  }
  const renderer = new ReactShallowRenderer()
  renderer.render(<PersonPickerItemRow {...props} />)
  expect(renderer.getRenderOutput()).toMatchSnapshot()
})
