import { describe, expect, it, jest } from '@jest/globals'
jest.mock('react-native-url-polyfill', () => ({ URL }))
import { canOpenExternalUrl, isHyloWebUrl, shouldLoadInWebView } from './linkNavigation'

describe('WebView link navigation', () => {
  it('keeps configured and known Hylo origins inside the mobile WebView', () => {
    expect(isHyloWebUrl('https://www.hylo.com/groups/example', 'http://localhost:3000')).toBe(true)
    expect(isHyloWebUrl('https://staging.hylo.com/groups/example', 'http://localhost:3000')).toBe(true)
    expect(isHyloWebUrl('http://localhost:3000/groups/example', 'http://localhost:3000')).toBe(true)
  })

  it('does not treat lookalike or external hosts as Hylo', () => {
    expect(isHyloWebUrl('https://hylo.com.example.org/', 'http://localhost:3000')).toBe(false)
    expect(isHyloWebUrl('https://www.youtube.com/watch?v=video', 'http://localhost:3000')).toBe(false)
  })

  it('keeps inline frames in the WebView but sends top-level YouTube pages out', () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=video'
    expect(shouldLoadInWebView(youtubeUrl, false, 'http://localhost:3000')).toBe(true)
    expect(shouldLoadInWebView(youtubeUrl, true, 'http://localhost:3000')).toBe(false)
    expect(shouldLoadInWebView('https://open.spotify.com/embed', false, 'http://localhost:3000')).toBe(false)
    expect(shouldLoadInWebView('javascript:alert(1)', false, 'http://localhost:3000')).toBe(false)
  })

  it('allows web, email, and telephone URLs to be opened externally', () => {
    expect(canOpenExternalUrl('https://open.spotify.com/track/example')).toBe(true)
    expect(canOpenExternalUrl('mailto:[EMAIL]')).toBe(true)
    expect(canOpenExternalUrl('tel:+15555550123')).toBe(true)
  })

  it('rejects unsafe or unsupported URL schemes', () => {
    expect(canOpenExternalUrl('javascript:alert(1)')).toBe(false)
    expect(canOpenExternalUrl('intent://open.spotify.com/')).toBe(false)
    expect(canOpenExternalUrl('not a URL')).toBe(false)
  })
})
