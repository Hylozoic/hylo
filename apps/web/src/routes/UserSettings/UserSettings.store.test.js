import { updateAllMemberships, registerStripeAccount, requestEmailChange, verifyEmailChange } from './UserSettings.store'

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

describe('requestEmailChange', () => {
  it('sends the email through updateMe without an optimistic update', () => {
    const action = requestEmailChange('new@example.com')
    expect(action.graphql.variables).toEqual({ changes: { email: 'new@example.com' } })
    expect(action.graphql.query).toContain('pendingEmail')
    expect(action.meta.optimistic).toBeUndefined()
  })
})

describe('verifyEmailChange', () => {
  it('passes the code or token', () => {
    expect(verifyEmailChange({ code: '123456' }).graphql.variables).toEqual({ code: '123456', token: undefined })
    expect(verifyEmailChange({ token: 'abc' }).graphql.variables).toEqual({ code: undefined, token: 'abc' })
  })
})
