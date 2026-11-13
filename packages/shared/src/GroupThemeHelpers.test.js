import {
  GROUP_THEME_TOKENS,
  parseHslTriple,
  sanitizeGroupTheme,
  validateGroupTheme
} from './GroupThemeHelpers'
import * as shared from './index'

describe('GroupThemeHelpers exports', () => {
  it('are available from the package index', () => {
    expect(shared.sanitizeGroupTheme).toBe(sanitizeGroupTheme)
    expect(shared.validateGroupTheme).toBe(validateGroupTheme)
    expect(shared.GroupThemeHelpers.parseHslTriple).toBe(parseHslTriple)
  })

  it('has no duplicate tokens', () => {
    expect(new Set(GROUP_THEME_TOKENS).size).toBe(GROUP_THEME_TOKENS.length)
  })
})

describe('validateGroupTheme', () => {
  it('accepts null and undefined as "no theme"', () => {
    expect(validateGroupTheme(null)).toEqual({ theme: null, errors: [] })
    expect(validateGroupTheme(undefined)).toEqual({ theme: null, errors: [] })
  })

  it('accepts a valid theme and returns it unchanged', () => {
    const theme = {
      light: { background: '150 22% 86%', 'card-foreground': '160 28% 11%' },
      dark: { background: '160 18% 12%' },
      radius: 'xl'
    }
    expect(validateGroupTheme(theme)).toEqual({ theme, errors: [] })
  })

  it('normalises formatting instead of rejecting it', () => {
    expect(validateGroupTheme({ light: { background: ' 150  22%  86% ' } }))
      .toEqual({ theme: { light: { background: '150 22% 86%' } }, errors: [] })
    expect(validateGroupTheme({ light: {}, radius: 'sm' }))
      .toEqual({ theme: { radius: 'sm' }, errors: [] })
  })

  it('rejects anything that is not an object', () => {
    ['forest', 42, true, [], [{ light: {} }]].forEach(raw => {
      expect(validateGroupTheme(raw).errors).toEqual(['Theme must be an object'])
    })
  })

  it('reports every part sanitizing would drop', () => {
    const { theme, errors } = validateGroupTheme(JSON.parse(JSON.stringify({
      light: { background: 'red', 'not-a-token': '1 2% 3%', card: '10 10% 10%' },
      dark: 'nope',
      sepia: {},
      radius: '9999px'
    })))
    expect(theme).toBeNull()
    expect(errors).toEqual([
      'Invalid value for light.background: expected an HSL triple like "120 15% 92%"',
      'Unknown token "not-a-token" in light',
      '"dark" must be an object of tokens',
      'Unknown theme key "sepia"',
      'Unknown radius "9999px"; use one of none, sm, md, lg, xl'
    ])
  })

  it('rejects a __proto__ key from parsed JSON', () => {
    const { errors } = validateGroupTheme(JSON.parse('{"light":{"__proto__":{"card":"0 0% 0%"}}}'))
    expect(errors).toEqual(['Unknown token "__proto__" in light'])
  })

  it('rejects inherited names posing as a radius', () => {
    expect(validateGroupTheme({ radius: 'toString' }).errors).toHaveLength(1)
  })

  it('agrees with sanitizeGroupTheme: whatever it accepts sanitizes to itself', () => {
    const raw = { light: { background: '1 2% 3%' }, dark: { accent: '360 100% 100%' }, radius: 'none' }
    const { theme } = validateGroupTheme(raw)
    expect(sanitizeGroupTheme(theme)).toEqual(theme)
  })
})
