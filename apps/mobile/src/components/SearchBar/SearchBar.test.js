import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import SearchBar from './SearchBar'

const testProps = {
  placeholder: undefined
}

describe('ItemChooser', () => {
  it('renders as expected (without value)', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<SearchBar {...testProps} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('renders as expected with value', () => {
    const props = {
      ...testProps,
      value: 'Anything'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<SearchBar {...props} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('renders as expected when loading', () => {
    const props = {
      ...testProps,
      loading: true
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<SearchBar {...props} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('renders with placeholder', () => {
    const props = {
      ...testProps,
      placeholder: 'Search anything'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<SearchBar {...props} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })
})
