import { themes, defaultTheme } from '../themes'
import {
  GROUP_THEME_TOKENS,
  appThemeCssVars,
  checkGroupThemeContrast,
  contrastRatio,
  groupThemeCssVars,
  parseHslTriple,
  readableTextColor,
  resolveGroupThemeTokens,
  sanitizeGroupTheme
} from './groupTheme'

describe('readableTextColor', () => {
  const WHITE = '0 0% 100%'

  it('leaves a color that already reads', () => {
    expect(readableTextColor('260 80% 30%', [WHITE])).toEqual('260 80% 30%')
  })

  it('darkens a pale color on light surfaces, keeping its hue and saturation', () => {
    const text = readableTextColor('266.7 78.3% 91%', [WHITE, '262.5 50% 96.9%'])
    expect(text).toMatch(/^266\.7 78\.3% /)
    expect(contrastRatio(text, WHITE)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(text, '262.5 50% 96.9%')).toBeGreaterThanOrEqual(4.5)
  })

  it('lightens a dark color on dark surfaces', () => {
    const text = readableTextColor('263.8 52.3% 25.5%', ['261.3 58.5% 10.4%', '259.1 78.6% 5.5%'])
    expect(parseHslTriple(text)[2]).toBeGreaterThan(25.5)
    expect(contrastRatio(text, '261.3 58.5% 10.4%')).toBeGreaterThanOrEqual(4.5)
  })

  it('returns the color unchanged when it cannot be read as HSL', () => {
    expect(readableTextColor('red', [WHITE])).toEqual('red')
  })
})

describe('text colors of a group theme', () => {
  it('gives a readable text version of a color the group chose', () => {
    const vars = groupThemeCssVars({ light: { selected: '266.7 78.3% 91%', card: '0 0% 100%' } }, 'light')
    expect(vars['--selected']).toEqual('266.7 78.3% 91%')
    expect(contrastRatio(vars['--selected-text'], '0 0% 100%')).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves colors the group did not choose as the default theme has them', () => {
    const vars = groupThemeCssVars({ light: { card: '0 0% 100%' } }, 'light')
    expect(vars['--selected-text']).toEqual(themes[defaultTheme].light.selected)
    expect(vars['--accent-text']).toEqual(themes[defaultTheme].light.accent)
  })

  it('is undone where an app theme is restored', () => {
    const vars = appThemeCssVars('forest', 'light')
    expect(vars['--selected-text']).toEqual(themes.forest.light.selected)
  })
})

describe('GROUP_THEME_TOKENS', () => {
  // The shared package keeps its own copy of the token list so the backend can
  // validate without importing web code. This keeps the two from drifting.
  it('equals the keys of the default theme', () => {
    expect(GROUP_THEME_TOKENS).toEqual(Object.keys(themes[defaultTheme].light))
  })
})

describe('parseHslTriple', () => {
  it('parses a plain HSL triple', () => {
    expect(parseHslTriple('145 50% 62%')).toEqual([145, 50, 62])
    expect(parseHslTriple('  0 84.2% 60.2% ')).toEqual([0, 84.2, 60.2])
  })

  it('rejects anything that is not a plain triple', () => {
    expect(parseHslTriple('red')).toBeNull()
    expect(parseHslTriple('145 50% 62%; background: url(https://example.com)')).toBeNull()
    expect(parseHslTriple('145 50% 62%) ; } body { display: none')).toBeNull()
    expect(parseHslTriple('var(--secondary)')).toBeNull()
    expect(parseHslTriple('400 50% 62%')).toBeNull()
    expect(parseHslTriple('145 150% 62%')).toBeNull()
    expect(parseHslTriple(145)).toBeNull()
    expect(parseHslTriple(null)).toBeNull()
  })
})

describe('sanitizeGroupTheme', () => {
  it('returns null when there is no usable theme', () => {
    expect(sanitizeGroupTheme(null)).toBeNull()
    expect(sanitizeGroupTheme('forest')).toBeNull()
    expect(sanitizeGroupTheme({})).toBeNull()
    expect(sanitizeGroupTheme({ light: { background: 'red' } })).toBeNull()
  })

  it('keeps known tokens with valid values and drops everything else', () => {
    const theme = sanitizeGroupTheme({
      light: {
        background: '120 15% 92%',
        accent: 'javascript:alert(1)',
        'not-a-token': '120 15% 92%',
        __proto__: { card: '0 0% 0%' }
      },
      dark: { background: '120  20%  14%' },
      sepia: { background: '30 30% 80%' },
      radius: 'xl',
      css: 'body { display: none }'
    })

    expect(theme).toEqual({
      light: { background: '120 15% 92%' },
      dark: { background: '120 20% 14%' },
      radius: 'xl'
    })
  })

  it('drops an unknown radius', () => {
    expect(sanitizeGroupTheme({ light: { background: '120 15% 92%' }, radius: '9999px' }))
      .toEqual({ light: { background: '120 15% 92%' } })
    expect(sanitizeGroupTheme({ light: { background: '120 15% 92%' }, radius: 'toString' }))
      .toEqual({ light: { background: '120 15% 92%' } })
  })
})

describe('resolveGroupThemeTokens', () => {
  it('lays group overrides over the default theme for the color scheme', () => {
    const tokens = resolveGroupThemeTokens({ light: { background: '120 15% 92%' } }, 'light')
    expect(tokens.background).toEqual('120 15% 92%')
    expect(tokens.foreground).toEqual(themes[defaultTheme].light.foreground)
  })

  it('falls back to the default theme for a scheme the group did not style', () => {
    const tokens = resolveGroupThemeTokens({ light: { background: '120 15% 92%' } }, 'dark')
    expect(tokens).toEqual(themes[defaultTheme].dark)
  })
})

describe('groupThemeCssVars', () => {
  it('returns null for a group without a usable theme', () => {
    expect(groupThemeCssVars(undefined, 'light')).toBeNull()
    expect(groupThemeCssVars({ light: { background: 'nope' } }, 'light')).toBeNull()
  })

  it('returns every token as a CSS variable, plus the radius, border width and fonts', () => {
    const vars = groupThemeCssVars({ light: { background: '120 15% 92%' }, radius: 'xl' }, 'light')
    expect(vars['--background']).toEqual('120 15% 92%')
    expect(vars['--foreground']).toEqual(themes[defaultTheme].light.foreground)
    expect(vars['--radius']).toEqual('0.875rem')
    // plus radius, border width, two fonts and the three text colors
    expect(Object.keys(vars)).toHaveLength(Object.keys(themes[defaultTheme].light).length + 7)
  })

  it('uses the default radius when the group did not choose one', () => {
    expect(groupThemeCssVars({ light: { background: '120 15% 92%' } }, 'light')['--radius']).toEqual('0.5rem')
  })
})

describe('appThemeCssVars', () => {
  it('returns the named app theme and the default radius', () => {
    const vars = appThemeCssVars('forest', 'dark')
    expect(vars['--background']).toEqual(themes.forest.dark.background)
    expect(vars['--radius']).toEqual('0.5rem')
  })

  it('falls back to the default theme for an unknown name', () => {
    expect(appThemeCssVars('nope', 'light')['--background']).toEqual(themes[defaultTheme].light.background)
  })
})

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 1)
    expect(contrastRatio('0 0% 100%', '0 0% 100%')).toBeCloseTo(1, 5)
    // #767676 on white is the well-known 4.54:1 threshold grey
    expect(contrastRatio('0 0% 46.3%', '0 0% 100%')).toBeCloseTo(4.54, 1)
  })

  it('returns null for an invalid color', () => {
    expect(contrastRatio('red', '0 0% 100%')).toBeNull()
  })
})

describe('checkGroupThemeContrast', () => {
  it('passes a theme whose changed pairs are readable', () => {
    const theme = { light: { background: '120 15% 92%', foreground: '95 10% 10%' } }
    expect(checkGroupThemeContrast(theme, 'light')).toEqual([])
  })

  it('reports a changed pair that is too low-contrast', () => {
    const theme = { light: { card: '50 100% 90%', 'card-foreground': '50 100% 80%' } }
    const problems = checkGroupThemeContrast(theme, 'light')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ text: 'card-foreground', surface: 'card', colorScheme: 'light' })
    expect(problems[0].ratio).toBeLessThan(4.5)
  })

  it('checks a changed surface against the default text color', () => {
    // A dark background under the default (dark) light-mode text
    const problems = checkGroupThemeContrast({ light: { background: '28 16% 12%' } }, 'light')
    expect(problems.map(p => `${p.text}/${p.surface}`)).toContain('foreground/background')
  })

  it('reports a darkening color too light for the white text on banner scrims', () => {
    const problems = checkGroupThemeContrast({ light: { darkening: '40 30% 80%' } }, 'light')
    expect(problems.map(p => `${p.text}/${p.surface}`)).toEqual(['white/darkening'])
    expect(checkGroupThemeContrast({ light: { darkening: '160 30% 8%' } }, 'light')).toEqual([])
  })

  it('does not report pairs the group left alone', () => {
    const problems = checkGroupThemeContrast({ light: { selected: '145 50% 62%' } }, 'light')
    expect(problems).toEqual([])
  })
})

describe('border width', () => {
  it('is set from the group theme, 2px by default', () => {
    expect(groupThemeCssVars({ borderWidth: 'thick' }, 'light')['--border-width']).toEqual('3px')
    expect(groupThemeCssVars({ borderWidth: 'thin' }, 'dark')['--border-width']).toEqual('1px')
    expect(groupThemeCssVars({ radius: 'xl' }, 'light')['--border-width']).toEqual('2px')
  })

  it("is reset to 2px for the app's own themes", () => {
    expect(appThemeCssVars('forest', 'light')['--border-width']).toEqual('2px')
  })
})

describe('fonts', () => {
  it('sets the body and heading fonts, headings following the body font', () => {
    const both = groupThemeCssVars({ fontBody: 'Inter', fontHeading: 'Playfair Display' }, 'light')
    expect(both['--font-body']).toEqual("'Inter'")
    expect(both['--font-display']).toEqual("'Playfair Display'")

    const bodyOnly = groupThemeCssVars({ fontBody: 'Inter' }, 'light')
    expect(bodyOnly['--font-display']).toEqual("'Inter'")

    const headingOnly = groupThemeCssVars({ fontHeading: 'Lora' }, 'light')
    expect(headingOnly['--font-body']).toEqual("'Onest'")
    expect(headingOnly['--font-display']).toEqual("'Lora'")
  })

  it("is reset to the app's font for the app's own themes", () => {
    const vars = appThemeCssVars('forest', 'light')
    expect(vars['--font-body']).toEqual("'Onest'")
    expect(vars['--font-display']).toEqual("'Onest'")
  })
})
