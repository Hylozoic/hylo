import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import SettingControl from './SettingControl'

it('matches last snapshot', () => {
  const renderer = new ReactShallowRenderer()
  const props = {
    label: 'Name',
    value: 'Joe Bloggs',
    onChange: () => {},
    toggleSecureTextEntry: true,
    toggleEditable: true,
    keyboardType: 'email-address',
    autoCapitalize: 'words',
    autoCorrect: true,
    onSubmitEditing: () => {},
    returnKeyType: 'next',
    style: { color: 'red' },
    error: 'This is not a real name'
  }

  renderer.render(<SettingControl {...props} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

it('toggles the password', () => {
  const instance = ReactTestRenderer.create(<SettingControl />).root.instance
  expect(instance.state.securePassword).toEqual(true)
  instance.togglePassword()
  expect(instance.state.securePassword).toEqual(false)
})

it('sets editable to false if toggleEditable', () => {
  let instance = ReactTestRenderer.create(<SettingControl />).root.instance
  instance.componentDidMount()
  expect(instance.state.editable).toEqual(true)

  instance = ReactTestRenderer.create(<SettingControl toggleEditable />).root.instance
  instance.componentDidMount()
  expect(instance.state.editable).toEqual(false)
})

describe('on toggleEditable', () => {
  it('toggles the state', () => {
    const instance = ReactTestRenderer.create(<SettingControl toggleEditable />).root.instance
    instance.setState({ editable: true })
    instance.toggleEditable()
    expect(instance.state.editable).toEqual(false)
    instance.toggleEditable()
    expect(instance.state.editable).toEqual(true)
  })
})

describe('on makeEditable', () => {
  it('sets the state', () => {
    const instance = ReactTestRenderer.create(<SettingControl toggleEditable />).root.instance
    instance.setState({ editable: false })
    instance.makeEditable()
    expect(instance.state.editable).toEqual(true)
  })
})

describe('on isEditable', () => {
  it('returns the state', () => {
    const instance = ReactTestRenderer.create(<SettingControl toggleEditable />).root.instance
    instance.setState({ editable: false })
    expect(instance.isEditable()).toEqual(false)
    instance.setState({ editable: true })
    expect(instance.isEditable()).toEqual(true)
  })
})

describe('on onSubmitEditing', () => {
  it('does all the things', () => {
    const props = {
      toggleEditable: true,
      onSubmitEditing: jest.fn()
    }
    const instance = ReactTestRenderer.create(<SettingControl {...props} />).root.instance
    instance.setState({ highlight: true })
    instance.onSubmitEditing()
    expect(instance.state.editable).toEqual(false)
    expect(props.onSubmitEditing).toHaveBeenCalled()
    expect(instance.state.highlight).toEqual(false)
  })
})

describe('on highlightCheck', () => {
  it('sets the state', () => {
    const instance = ReactTestRenderer.create(<SettingControl />).root.instance
    expect(instance.state.highlight).toEqual(false)
    instance.highlightCheck()
    expect(instance.state.highlight).toEqual(true)
  })
})
