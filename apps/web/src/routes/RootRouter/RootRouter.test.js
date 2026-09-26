import { isNeutralRootSessionLoadingPath } from './RootRouter'

describe('isNeutralRootSessionLoadingPath', () => {
  it('keeps invitation links on the neutral loading screen while the session loads', () => {
    expect(isNeutralRootSessionLoadingPath('/h/use-invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/h/invitation')).toBe(true)
    expect(isNeutralRootSessionLoadingPath('/groups/garden/join/join-code')).toBe(true)
  })

  it('uses the app shell for main app paths', () => {
    expect(isNeutralRootSessionLoadingPath('/groups/garden')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h')).toBe(false)
    expect(isNeutralRootSessionLoadingPath('/h/invitation/extra')).toBe(false)
  })
})
