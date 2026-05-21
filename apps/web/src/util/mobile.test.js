import { mobileRedirect, isPhoneDevice } from './mobile'

jest.mock('ismobilejs', () => ({
  apple: {
    device: true,
    phone: true,
    tablet: false
  },
  android: {
    phone: false,
    tablet: false
  },
  seven_inch: false
}))

it('returns truthy if mobile', () => {
  expect(mobileRedirect()).toBeTruthy()
})

it('isPhoneDevice is true for phones', () => {
  expect(isPhoneDevice()).toBe(true)
})

describe('isPhoneDevice with tablet UA', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('ismobilejs', () => ({
      apple: { phone: false, ipod: false, tablet: true },
      android: { phone: false, tablet: false },
      seven_inch: false
    }))
  })

  it('is false for tablets', () => {
    const { isPhoneDevice: isPhone } = require('./mobile')
    expect(isPhone()).toBe(false)
  })
})
