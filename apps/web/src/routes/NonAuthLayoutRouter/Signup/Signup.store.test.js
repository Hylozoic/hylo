import { register, verifyEmail } from './Signup.store'

const ANONYMOUS_ID = 'anon-test-id'

beforeEach(() => {
  window.localStorage.setItem('hylo_anonymous_id', ANONYMOUS_ID)
})

afterEach(() => {
  window.localStorage.removeItem('hylo_anonymous_id')
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
