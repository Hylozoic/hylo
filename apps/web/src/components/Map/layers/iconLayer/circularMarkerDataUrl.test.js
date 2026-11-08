import { markerUrlForAvatar } from './circularMarkerDataUrl'

describe('markerUrlForAvatar', () => {
  it('keeps a pre-cut circular map avatar', () => {
    expect(markerUrlForAvatar('https://cdn.example/avatar-forMap.png', 'Community Hub', 'initials'))
      .toBe('https://cdn.example/avatar-forMap.png')
  })

  it('does not draw a square upload before it has been clipped to a circle', () => {
    expect(markerUrlForAvatar('https://cdn.example/avatar.jpg', 'Community Hub', 'initials'))
      .toBe('initials')
  })

  it('uses initials when the group has no avatar', () => {
    expect(markerUrlForAvatar(null, 'Community Hub', 'initials')).toBe('initials')
  })
})
