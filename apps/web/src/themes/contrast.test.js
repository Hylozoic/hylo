// WCAG contrast of the secondary-text colour (D75): foreground-muted must be at least
// 4.5:1 against every surface text sits on, in every theme and mode
import { themes } from './index'

const SURFACES = ['background', 'midground', 'card']
const AA = 4.5

const parseHsl = value => {
  const [h, s, l] = value.split(/\s+/).map(part => parseFloat(part))
  return { h, s: s / 100, l: l / 100 }
}

function hslToRgb ({ h, s, l }) {
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [channel(0), channel(8), channel(4)]
}

const linear = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

const luminance = hsl => {
  const [r, g, b] = hslToRgb(parseHsl(hsl)).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('theme contrast (D75)', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 5)
    expect(contrastRatio('0 0% 50%', '0 0% 50%')).toBeCloseTo(1, 5)
  })

  const cases = Object.entries(themes).flatMap(([name, theme]) =>
    ['light', 'dark'].flatMap(mode => SURFACES.map(surface => [name, mode, surface, theme[mode]])))

  it('covers every theme', () => {
    expect(Object.keys(themes).length).toBeGreaterThanOrEqual(9)
    Object.values(themes).forEach(theme => {
      expect(theme.light['foreground-muted']).toBeDefined()
      expect(theme.dark['foreground-muted']).toBeDefined()
    })
  })

  it.each(cases)('%s %s: muted text on %s is at least 4.5:1', (name, mode, surface, colors) => {
    expect(contrastRatio(colors['foreground-muted'], colors[surface])).toBeGreaterThanOrEqual(AA)
  })

  it.each(Object.keys(themes))('%s: body text stays at least 4.5:1 in both modes', name => {
    for (const mode of ['light', 'dark']) {
      const colors = themes[name][mode]
      for (const surface of SURFACES) {
        expect(contrastRatio(colors.foreground, colors[surface])).toBeGreaterThanOrEqual(AA)
      }
    }
  })
})
