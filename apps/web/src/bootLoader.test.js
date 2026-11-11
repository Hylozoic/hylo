import fs from 'fs'
import path from 'path'

// The boot loading screen is an inline script in index.html that runs before
// the app. Run that script against a stub page to check how it animates.
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8')
const bootScript = indexHtml.match(/<div id="hylo-boot-loader"[^>]*><\/div>\s*<script>([\s\S]*?)<\/script>/)[1]

function startLoader ({ reducedMotion }) {
  document.body.innerHTML = '<div id="hylo-boot-loader"></div>'
  delete window.HyloBootLoader
  const frames = []
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length }
  window.matchMedia = query => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
    addEventListener: () => {},
    removeEventListener: () => {}
  })
  // eslint-disable-next-line no-new-func
  new Function(bootScript)()

  let now = 0
  return {
    // Runs animation frames until `seconds` of loader time have passed
    advance (seconds) {
      const end = now + seconds * 1000
      while (now < end && frames.length > 0) {
        now += 50
        const callback = frames.shift()
        callback(now)
      }
    },
    snapshot () {
      const host = document.getElementById('hylo-boot-loader')
      return {
        shapes: Array.from(host.querySelectorAll('g, line')).map(el => [
          el.getAttribute('transform'),
          el.getAttribute('opacity'),
          el.getAttribute('stroke-dashoffset')
        ].join('|')).join(';'),
        progress: host.querySelector('#hylo-boot-progress').style.width
      }
    }
  }
}

describe('boot loading screen', () => {
  const originalMatchMedia = window.matchMedia
  const originalRaf = window.requestAnimationFrame

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    window.requestAnimationFrame = originalRaf
    delete window.HyloBootLoader
    document.body.innerHTML = ''
  })

  it('animates the mark by default', () => {
    const loader = startLoader({ reducedMotion: false })
    loader.advance(0.5)
    const early = loader.snapshot()
    loader.advance(3)
    expect(loader.snapshot().shapes).not.toEqual(early.shapes)
  })

  it('shows a still, assembled mark with reduced motion, and only the progress bar moves', () => {
    const loader = startLoader({ reducedMotion: true })
    loader.advance(0.2)
    const early = loader.snapshot()
    loader.advance(6)
    const later = loader.snapshot()
    expect(later.shapes).toEqual(early.shapes)
    expect(parseFloat(later.progress)).toBeGreaterThan(parseFloat(early.progress))
  })

  it('keeps milestone() and ready() available with reduced motion', () => {
    startLoader({ reducedMotion: true })
    expect(typeof window.HyloBootLoader.milestone).toBe('function')
    expect(typeof window.HyloBootLoader.ready).toBe('function')
  })
})
