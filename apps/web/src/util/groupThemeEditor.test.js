import { themes, defaultTheme } from '../themes'
import { contrastRatio, MIN_CONTRAST_RATIO, sanitizeGroupTheme } from './groupTheme'
import {
  canSaveWithContrastIssues,
  compactTheme,
  deriveTokensFromRoles,
  draftFromSavedTheme,
  getContrastIssues,
  getRoleColors,
  hexToHslTriple,
  hslTripleToHex,
  mixHslTriples,
  prepareThemeForSave,
  presetToDraft,
  PRESET_NAMES,
  roleForContrastIssue,
  setBorderWidth,
  setRadius,
  setRoleColor,
  themesMatch
} from './groupThemeEditor'

const base = themes[defaultTheme]

describe('hexToHslTriple and hslTripleToHex', () => {
  it('converts hex colors to plain HSL triples', () => {
    expect(hexToHslTriple('#ffffff')).toEqual('0 0% 100%')
    expect(hexToHslTriple('#000000')).toEqual('0 0% 0%')
    expect(hexToHslTriple('#ff0000')).toEqual('0 100% 50%')
    expect(hexToHslTriple('#00f')).toEqual('240 100% 50%')
  })

  it('rejects anything that is not a hex color', () => {
    expect(hexToHslTriple('red')).toBeNull()
    expect(hexToHslTriple('#12345')).toBeNull()
    expect(hexToHslTriple(null)).toBeNull()
  })

  it('converts HSL triples to hex colors', () => {
    expect(hslTripleToHex('0 0% 100%')).toEqual('#ffffff')
    expect(hslTripleToHex('120 100% 25%')).toEqual('#008000')
    expect(hslTripleToHex('not a color')).toBeNull()
  })

  it('round-trips without drifting', () => {
    ['#3a7bd5', '#f4e9d8', '#1d2b1f', '#c0ffee'].forEach(hex => {
      const triple = hexToHslTriple(hex)
      expect(hexToHslTriple(hslTripleToHex(triple))).toEqual(triple)
    })
  })

  it('always produces values the sanitizer keeps unchanged', () => {
    const triple = hexToHslTriple('#3a7bd5')
    expect(sanitizeGroupTheme({ light: { background: triple } })).toEqual({ light: { background: triple } })
  })
})

describe('mixHslTriples', () => {
  it('returns the ends at 0 and 1 and grey in the middle of black and white', () => {
    expect(mixHslTriples('0 0% 0%', '0 0% 100%', 0)).toEqual('0 0% 0%')
    expect(mixHslTriples('0 0% 0%', '0 0% 100%', 1)).toEqual('0 0% 100%')
    expect(mixHslTriples('0 0% 0%', '0 0% 100%', 0.5)).toEqual('0 0% 50%')
  })
})

describe('deriveTokensFromRoles', () => {
  const roles = {
    background: '150 22% 86%',
    card: '150 30% 97%',
    text: '160 28% 11%',
    primary: '160 60% 25%',
    accent: '30 90% 55%',
    selected: '145 50% 62%'
  }

  it('maps each role to its own token', () => {
    const tokens = deriveTokensFromRoles(roles)
    expect(tokens.background).toEqual(roles.background)
    expect(tokens.card).toEqual(roles.card)
    expect(tokens.foreground).toEqual(roles.text)
    expect(tokens.primary).toEqual(roles.primary)
    expect(tokens.accent).toEqual(roles.accent)
    expect(tokens.selected).toEqual(roles.selected)
  })

  it('uses the text color on cards and popovers, and the card color for popovers and inputs', () => {
    const tokens = deriveTokensFromRoles(roles)
    expect(tokens['card-foreground']).toEqual(roles.text)
    expect(tokens['popover-foreground']).toEqual(roles.text)
    expect(tokens.popover).toEqual(roles.card)
    expect(tokens.input).toEqual(roles.card)
  })

  it('picks readable text for primary buttons, accents and muted surfaces', () => {
    const tokens = deriveTokensFromRoles(roles)
    expect(contrastRatio(tokens['primary-foreground'], tokens.primary)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    expect(contrastRatio(tokens['accent-foreground'], tokens.accent)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
    expect(contrastRatio(tokens['muted-foreground'], tokens.muted)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
  })

  it('keeps the chosen text color on the primary button when it is readable', () => {
    const tokens = deriveTokensFromRoles({ ...roles, primary: '150 30% 95%' })
    expect(tokens['primary-foreground']).toEqual(roles.text)
  })

  it('places the midground between the background and the card', () => {
    const tokens = deriveTokensFromRoles({ ...roles, background: '0 0% 80%', card: '0 0% 100%' })
    expect(tokens.midground).toEqual('0 0% 90%')
  })
})

describe('setRoleColor', () => {
  it('sets the role and recalculates only its dependents, in one scheme', () => {
    const draft = { light: { secondary: '120 15% 45%' }, radius: 'xl' }
    const result = setRoleColor(draft, 'light', 'background', '150 22% 86%')
    expect(result.light.background).toEqual('150 22% 86%')
    expect(result.light.midground).toBeDefined()
    expect(result.light.border).toBeDefined()
    expect(result.light.secondary).toEqual('120 15% 45%')
    expect(result.light.primary).toBeUndefined()
    expect(result.dark).toBeUndefined()
    expect(result.radius).toEqual('xl')
  })

  it('maps text to the foreground tokens', () => {
    const result = setRoleColor({}, 'dark', 'text', '0 0% 90%')
    expect(result.dark.foreground).toEqual('0 0% 90%')
    expect(result.dark['card-foreground']).toEqual('0 0% 90%')
  })

  it('ignores unknown roles and invalid colors', () => {
    const draft = { light: { background: '150 22% 86%' } }
    expect(setRoleColor(draft, 'light', 'banana', '0 0% 0%')).toBe(draft)
    expect(setRoleColor(draft, 'light', 'card', 'red')).toBe(draft)
  })

  it('reads role colors back from the draft, over the default theme', () => {
    const roles = getRoleColors({ light: { card: '0 0% 100%' } }, 'light')
    expect(roles.card).toEqual('0 0% 100%')
    expect(roles.text).toEqual(base.light.foreground)
    expect(roles.selected).toEqual(base.light.selected)
  })
})

describe('setRadius', () => {
  it('accepts only known radii', () => {
    expect(setRadius({}, 'xl')).toEqual({ radius: 'xl' })
    expect(setRadius({ radius: 'sm' }, 'huge')).toEqual({ radius: 'sm' })
  })
})

describe('presetToDraft', () => {
  it('gives an empty draft for the default theme', () => {
    expect(presetToDraft('default')).toEqual({})
    expect(presetToDraft('no-such-theme')).toEqual({})
  })

  it('holds the tokens where a preset differs from the default theme', () => {
    const draft = presetToDraft('forest')
    expect(draft.light.background).toEqual(themes.forest.light.background)
    expect(draft.dark.background).toEqual(themes.forest.dark.background)
    expect(draft.light.destructive).toBeUndefined()
    expect(draft.radius).toBeUndefined()
  })

  it('produces a theme the sanitizer keeps unchanged, for every preset', () => {
    PRESET_NAMES.forEach(name => {
      const { theme, valid } = prepareThemeForSave(presetToDraft(name))
      expect(valid).toBe(true)
      if (name === defaultTheme) expect(theme).toBeNull()
      else expect(sanitizeGroupTheme(theme)).toEqual(theme)
    })
  })

  it('passes the contrast check, for every preset', () => {
    PRESET_NAMES.forEach(name => {
      expect(getContrastIssues(compactTheme(presetToDraft(name)))).toEqual({ light: [], dark: [] })
    })
  })

  it('re-picks the text on accents for contrast', () => {
    const draft = presetToDraft('forest')
    expect(contrastRatio(draft.dark['accent-foreground'], draft.dark.accent)).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO)
  })
})

describe('compactTheme and prepareThemeForSave', () => {
  it('drops tokens equal to the default theme and the default radius', () => {
    const draft = {
      light: { background: base.light.background, card: '0 0% 100%' },
      dark: { background: base.dark.background },
      radius: 'lg'
    }
    expect(compactTheme(draft)).toEqual({ light: { card: '0 0% 100%' } })
  })

  it('gives null for a draft that is the default look', () => {
    expect(compactTheme({})).toBeNull()
    expect(prepareThemeForSave({ radius: 'lg' })).toEqual({ theme: null, valid: true })
  })

  it('keeps a non-default radius', () => {
    expect(prepareThemeForSave({ radius: 'none' })).toEqual({ theme: { radius: 'none' }, valid: true })
  })

  it('compares drafts by what would be stored', () => {
    expect(themesMatch({ radius: 'lg' }, null)).toBe(true)
    expect(themesMatch({ radius: 'xl' }, null)).toBe(false)
  })

  it('turns a saved theme into a draft', () => {
    expect(draftFromSavedTheme(null)).toEqual({})
    expect(draftFromSavedTheme({ radius: 'sm', light: { bogus: '1 1% 1%' } })).toEqual({ radius: 'sm' })
  })
})

describe('contrast', () => {
  it('reports failures for both schemes, next to the surface role', () => {
    const draft = setRoleColor(setRoleColor({}, 'light', 'background', '0 0% 20%'), 'dark', 'card', '0 0% 95%')
    const issues = getContrastIssues(draft)
    expect(issues.light.map(roleForContrastIssue)).toContain('background')
    expect(issues.dark.map(roleForContrastIssue)).toContain('card')
  })

  it('maps pairs outside the roles to no role', () => {
    expect(roleForContrastIssue({ text: 'secondary-foreground', surface: 'secondary' })).toBeNull()
  })

  it('blocks saving with failures unless overridden', () => {
    expect(canSaveWithContrastIssues({ issueCount: 0, override: false })).toBe(true)
    expect(canSaveWithContrastIssues({ issueCount: 2, override: false })).toBe(false)
    expect(canSaveWithContrastIssues({ issueCount: 2, override: true })).toBe(true)
  })
})

describe('border width', () => {
  it('sets a known width and ignores unknown ones', () => {
    expect(setBorderWidth({}, 'thick')).toEqual({ borderWidth: 'thick' })
    expect(setBorderWidth({ borderWidth: 'thin' }, '9px')).toEqual({ borderWidth: 'thin' })
  })

  it('is saved only when it differs from the default', () => {
    expect(prepareThemeForSave({ borderWidth: 'regular' })).toEqual({ theme: null, valid: true })
    expect(prepareThemeForSave({ borderWidth: 'thin' })).toEqual({ theme: { borderWidth: 'thin' }, valid: true })
    expect(themesMatch({ borderWidth: 'regular' }, null)).toBe(true)
    expect(themesMatch({ borderWidth: 'thick' }, null)).toBe(false)
  })
})
