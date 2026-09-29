import { AnalyticsEvents } from '@hylo/shared'
import { register, sendEmailVerification, verifyEmail } from './Signup.store'

describe('sendEmailVerification', () => {
  afterEach(() => window.localStorage.clear())

  it('sends the stored first-touch source with the request', () => {
    window.localStorage.setItem('hyloAcquisitionSource', JSON.stringify({ utmSource: 'newsletter', channel: 'invite' }))
    const { graphql } = sendEmailVerification('test@hylo.com')
    expect(graphql.variables).toEqual({ email: 'test@hylo.com', acquisitionSource: { utmSource: 'newsletter', channel: 'invite' } })
    expect(graphql.query).toMatch(/acquisitionSource: \$acquisitionSource/)
  })

  it('sends no source when none is stored', () => {
    expect(sendEmailVerification('test@hylo.com').graphql.variables.acquisitionSource).toBeUndefined()
  })

  it('tracks the event without the email address', () => {
    const { analytics } = sendEmailVerification('test@hylo.com').meta
    expect(analytics).toEqual({ eventName: AnalyticsEvents.SIGNUP_EMAIL_VERIFICATION_SENT })
    expect(JSON.stringify(analytics)).not.toContain('test@hylo.com')
  })
})

describe('register', () => {
  it('should match latest snapshot', () => {
    expect(register('name', 'test@hylo.com', 'testPassword')).toMatchSnapshot()
  })

  it('selects the error returned by the server', () => {
    expect(register('name', 'testPassword').graphql.query).toMatch(/^\s*error\s*$/m)
  })

  it('does not track Registered from the action, so a failed registration is not counted', () => {
    expect(register('name', 'testPassword').meta.analytics).toBeUndefined()
  })
})

describe('verifyEmail', () => {
  it('does not track Email Verified from the action, so a wrong code is not counted', () => {
    expect(verifyEmail('test@hylo.com', '123456').meta.analytics).toBeUndefined()
  })
})
