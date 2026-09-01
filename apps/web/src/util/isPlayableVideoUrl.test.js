import isPlayableVideoUrl, { getVideoEmbedUrl } from './isPlayableVideoUrl'

describe('isPlayableVideoUrl', () => {
  it('detects YouTube and Vimeo watch URLs', () => {
    expect(isPlayableVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isPlayableVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isPlayableVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true)
    expect(isPlayableVideoUrl('https://vimeo.com/70509133')).toBe(true)
  })

  it('rejects non-video and empty URLs', () => {
    expect(isPlayableVideoUrl('https://www.hylo.com/awitp')).toBe(false)
    expect(isPlayableVideoUrl('https://www.youtube.com/about')).toBe(false)
    expect(isPlayableVideoUrl('')).toBe(false)
    expect(isPlayableVideoUrl(null)).toBe(false)
  })
})

describe('getVideoEmbedUrl', () => {
  it('returns YouTube and Vimeo embed srcs', () => {
    expect(getVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(getVideoEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=12')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(getVideoEmbedUrl('https://vimeo.com/70509133')).toBe('https://player.vimeo.com/video/70509133')
  })

  it('returns null for non-video URLs', () => {
    expect(getVideoEmbedUrl('https://www.hylo.com/awitp')).toBe(null)
  })
})
