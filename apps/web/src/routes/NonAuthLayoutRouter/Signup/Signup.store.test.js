import { AnalyticsEvents } from '@hylo/shared'
import { register, sendEmailVerification, verifyEmail } from './Signup.store'

describe('sendEmailVerification', () => {
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
