import { cacheControlForStaticFile } from './staticCache'

describe('cacheControlForStaticFile', () => {
  it('caches content-hashed build files for a year', () => {
    expect(cacheControlForStaticFile('/app/dist/assets/index.a1B2c3D4.js'))
      .toBe('public, max-age=31536000, immutable')
    expect(cacheControlForStaticFile('/app/dist/assets/style.a1B2c3D4.css'))
      .toBe('public, max-age=31536000, immutable')
  })

  it('does not long-cache unhashed public files that share the assets folder', () => {
    expect(cacheControlForStaticFile('/app/dist/assets/hylo.svg')).toBe(null)
    expect(cacheControlForStaticFile('/app/dist/assets/hylo-logotype.svg')).toBe(null)
    expect(cacheControlForStaticFile('/app/dist/assets/fonts/Circular-Font-Family/lineto-circular-book.ttf')).toBe(null)
    expect(cacheControlForStaticFile('/app/dist/locales/en.json')).toBe(null)
  })

  it('tells caches to revalidate the html shell', () => {
    expect(cacheControlForStaticFile('/app/dist/index.html')).toBe('no-cache')
  })
})
