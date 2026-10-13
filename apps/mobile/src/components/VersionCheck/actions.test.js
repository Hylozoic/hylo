import { checkVersion } from './actions'

describe('checkVersion', () => {
  it('matches the existing snapshot', () => {
    const platform = 'ios'
    const version = '1.0'
    expect(checkVersion(platform, version)).toMatchSnapshot()
  })
})
