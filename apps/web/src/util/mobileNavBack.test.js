import { historyIndexBackDelta, profileDirectLoadBackPath } from './mobileNavBack'

describe('historyIndexBackDelta', () => {
  it('returns to the page the profile was opened from', () => {
    expect(historyIndexBackDelta({ currentIndex: 6, entryIndex: 4 })).toBe(-2)
  })

  it('pops one entry when nothing was pushed after the profile', () => {
    expect(historyIndexBackDelta({ currentIndex: 5, entryIndex: 4 })).toBe(-1)
  })

  it('does not jump away while a post overlay is open', () => {
    expect(historyIndexBackDelta({ currentIndex: 6, entryIndex: 4, postOverlayOpen: true })).toBeNull()
  })

  it('does not go back when the profile is the first history entry', () => {
    expect(historyIndexBackDelta({ currentIndex: 0, entryIndex: -1 })).toBeNull()
  })
})

describe('profileDirectLoadBackPath', () => {
  it('sends a directly opened group profile to that group home', () => {
    expect(profileDirectLoadBackPath({ context: 'groups', groupSlug: 'hylo' })).toBe('/groups/hylo')
  })

  it('sends a directly opened all-context profile to All', () => {
    expect(profileDirectLoadBackPath({ context: 'all' })).toBe('/all')
  })
})
