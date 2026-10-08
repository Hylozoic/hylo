import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import { SignupLink } from './Login'

jest.mock('util/platform', () => ({ isIOS: false }))
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(() => Promise.resolve()),
    getTokens: jest.fn(() => ({ accessToken: 'faketoken' })),
    configure: jest.fn()
  }
}))

describe('SignupLink', () => {
  it('renders correctly', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<SignupLink goToSignup={jest.fn()} />)
    const actual = renderer.getRenderOutput()
    expect(actual).toMatchSnapshot()
  })
})
