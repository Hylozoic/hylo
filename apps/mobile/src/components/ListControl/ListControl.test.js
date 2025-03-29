import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ListControl from './ListControl'

const filterOptions = [
  { id: null, label: 'All' },
  { id: 'test', label: 'Test Item 1' },
  { id: 'test2', label: 'Test Item 2' }
]

describe('ListControl', () => {
  it('renders correctly', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <ListControl
        selected='discussion'
        options={filterOptions}
        onChange={() => {}}
      />
    )
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })
})
