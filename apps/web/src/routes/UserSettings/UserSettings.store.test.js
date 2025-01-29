import { updateAllMemberships, registerStripeAccount } from './UserSettings.store'

describe('updateAllMemberships', () => {
  it('matches snapshot', () => {
    expect(updateAllMemberships({ sendEmail: true })).toMatchSnapshot()
  })
})

describe('registerStripeAccount', () => {
  it('matches snapshot', () => {
    expect(registerStripeAccount('anauthorizationcodexyz')).toMatchSnapshot()
  })
})
