import fs from 'fs'
import path from 'path'

const publicDir = path.resolve(__dirname, '../public')
const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'))
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8')

describe('web manifest', () => {
  it('names the app Hylo', () => {
    expect(manifest.name).toBe('Hylo')
    expect(manifest.short_name).toBe('Hylo')
  })

  it('starts at the site root and covers the whole site', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
  })

  it('uses the same colours as index.html', () => {
    const themeColor = indexHtml.match(/<meta name="theme-color" content="([^"]+)"/)[1]
    const pageBackground = indexHtml.match(/html, body \{ background: (#[0-9A-Fa-f]{6}); \}/)[1]
    expect(manifest.theme_color.toLowerCase()).toBe(themeColor.toLowerCase())
    expect(manifest.background_color.toLowerCase()).toBe(pageBackground.toLowerCase())
  })

  it('stays a normal browser page (no standalone display)', () => {
    expect(manifest.display).toBeUndefined()
  })

  it('only lists icons that exist', () => {
    expect(manifest.icons.length).toBeGreaterThan(0)
    manifest.icons.forEach(icon => {
      expect(fs.existsSync(path.join(publicDir, icon.src))).toBe(true)
    })
  })
})
