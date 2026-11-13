import React, { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import useAppearance from 'hooks/useAppearance'
import getMe from 'store/selectors/getMe'
import updateGroupTheme from 'store/actions/updateGroupTheme'
import { applyAppearanceToDocument, getAppearanceFromSettings } from 'util/appearance'
import { cn } from 'util/index'
import {
  GROUP_THEME_BORDER_WIDTHS,
  GROUP_THEME_RADII,
  MIN_CONTRAST_RATIO,
  appThemeCssVars,
  groupThemeCssVars,
  loadGroupThemeFonts,
  sanitizeGroupTheme
} from 'util/groupTheme'
import { fetchGoogleFontFamilies } from 'util/googleFonts'
import {
  BORDER_WIDTH_OPTIONS,
  COLOR_SCHEMES,
  DEFAULT_BORDER_WIDTH_OPTION,
  DEFAULT_RADIUS_OPTION,
  PRESET_NAMES,
  RADIUS_OPTIONS,
  THEME_ROLES,
  canSaveWithContrastIssues,
  compactTheme,
  draftFromSavedTheme,
  getContrastIssues,
  getRoleColors,
  hexToHslTriple,
  hslTripleToHex,
  nonColorSettings,
  prepareThemeForSave,
  presetToDraft,
  roleForContrastIssue,
  setBorderWidth,
  setFont,
  setRadius,
  setRoleColor,
  themesMatch
} from 'util/groupThemeEditor'
import { themes, defaultTheme } from '../../../themes'
import GroupThemePreview from './GroupThemePreview'
import useGroupThemePreview from './useGroupThemePreview'

const ROLE_LABELS = {
  background: ['Background', 'Page and menu background'],
  card: ['Card', 'Posts, panels and dialogs'],
  text: ['Text', 'Main text color'],
  primary: ['Primary button', 'Main action buttons'],
  accent: ['Accent', 'Highlights and badges'],
  selected: ['Selected', 'Active and selected items']
}

const RADIUS_LABELS = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra large'
}

const BORDER_WIDTH_LABELS = {
  thin: 'Thin',
  regular: 'Regular',
  thick: 'Thick'
}

const FONT_FIELDS = [
  { key: 'fontHeading', label: 'Heading font', defaultLabel: 'Same as body font' },
  { key: 'fontBody', label: 'Body font', defaultLabel: 'Default (Onest)' }
]

const PRESET_SWATCHES = ['background', 'card', 'primary', 'accent', 'selected']

function swatchColor (triple) {
  return triple ? `hsl(${triple.split(' ').join(', ')})` : 'transparent'
}

function errorMessage (error) {
  if (!error) return null
  if (typeof error === 'string') return error
  return error.message || String(error)
}

function ContrastWarning ({ issue }) {
  const { t } = useTranslation()
  return (
    <p className='flex items-start gap-1 text-xs text-destructive mt-1' data-testid='contrast-warning'>
      <AlertTriangle className='h-3 w-3 mt-0.5 shrink-0' />
      <span>
        {t('Low contrast: {{text}} on {{surface}} is {{ratio}}:1 (needs {{min}}:1)', {
          text: issue.text,
          surface: issue.surface,
          ratio: issue.ratio,
          min: MIN_CONTRAST_RATIO
        })}
      </span>
    </p>
  )
}

/**
 * Lets a steward pick, preview and save the group's theme (group.settings.theme).
 */
export default function GroupThemeEditor ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const { theme: viewerThemeName } = getAppearanceFromSettings(currentUser?.settings)
  const { effectiveColorScheme } = useAppearance()

  const savedKey = JSON.stringify(sanitizeGroupTheme(group?.settings?.theme) || null)
  const saved = useMemo(() => JSON.parse(savedKey), [savedKey])

  const [draft, setDraft] = useState(() => draftFromSavedTheme(saved))
  const [scheme, setScheme] = useState(effectiveColorScheme === 'dark' ? 'dark' : 'light')
  const [override, setOverride] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  // A new saved theme (after saving, or a refetch that changed it) starts a fresh draft
  useEffect(() => {
    setDraft(draftFromSavedTheme(saved))
    setOverride(false)
  }, [savedKey])

  const [fontFamilies, setFontFamilies] = useState([])
  useEffect(() => {
    let current = true
    fetchGoogleFontFamilies().then(families => { if (current) setFontFamilies(families) })
    return () => { current = false }
  }, [])

  // Load the draft's fonts so the preview shows them
  useEffect(() => { loadGroupThemeFonts(draft) }, [draft.fontBody, draft.fontHeading])

  const dirty = !themesMatch(draft, saved)
  const compacted = useMemo(() => compactTheme(draft), [draft])
  const issues = useMemo(() => getContrastIssues(compacted), [compacted])
  const issueCount = issues.light.length + issues.dark.length
  const { theme: themeToSave, valid } = useMemo(() => prepareThemeForSave(draft), [draft])
  const contrastAllowsSave = canSaveWithContrastIssues({ issueCount, override })
  const canSave = dirty && valid && contrastAllowsSave && !saving

  // The page follows the scheme being edited, so stewards see what they change.
  // This is a preview only: the viewer's own setting is not touched and comes
  // back when they switch back or leave the editor.
  const previewingOtherScheme = scheme !== effectiveColorScheme
  useEffect(() => {
    if (!previewingOtherScheme) return
    applyAppearanceToDocument(viewerThemeName, scheme)
    return () => applyAppearanceToDocument(viewerThemeName, effectiveColorScheme)
  }, [previewingOtherScheme, scheme, effectiveColorScheme, viewerThemeName])

  // With no saved theme and no changes there is nothing of the group's to preview
  useGroupThemePreview({
    draft,
    active: dirty || (previewingOtherScheme && !!saved),
    colorScheme: scheme,
    viewerThemeName
  })

  const roleColors = getRoleColors(draft, scheme)
  const radius = draft.radius || DEFAULT_RADIUS_OPTION
  const borderWidth = draft.borderWidth || DEFAULT_BORDER_WIDTH_OPTION
  const otherScheme = scheme === 'light' ? 'dark' : 'light'
  const schemeLabel = value => value === 'dark' ? t('Dark') : t('Light')

  const edit = nextDraft => {
    setDraft(nextDraft)
    setStatus(null)
  }

  const save = async theme => {
    setSaving(true)
    setStatus(null)
    try {
      const result = await dispatch(updateGroupTheme(group.id, theme))
      if (result?.error) throw result.payload || new Error(t('Something went wrong. Please try again.'))
      setStatus({ type: 'success', message: theme ? t('Theme saved') : t('Theme reset to default') })
    } catch (error) {
      setStatus({ type: 'error', message: t('Could not save the theme: {{message}}', { message: errorMessage(error) }) })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (!canSave) return
    save(themeToSave)
  }

  const handleReset = () => {
    if (window.confirm(t("Remove this group's theme and go back to Hylo's default look?"))) {
      save(null)
    }
  }

  const handleRevert = () => edit(draftFromSavedTheme(saved))

  const handlePreset = name => edit({ ...presetToDraft(name), ...nonColorSettings(draft) })

  const issuesByRole = role => issues[scheme].filter(issue => roleForContrastIssue(issue) === role)
  const otherIssues = issues[scheme].filter(issue => !roleForContrastIssue(issue))

  return (
    <section className='mb-8 max-w-[720px]' data-testid='group-theme-editor'>
      <h3 className='text-lg font-bold mb-1'>{t('Group theme')}</h3>
      <p className='text-sm text-foreground/70 mb-4'>
        {t("Give this group its own colors, corner radius and border width. The global navigation keeps each member's own theme.")}
      </p>

      <div className='mb-6'>
        <label className='text-sm font-medium mb-2 block'>{t('Start from a preset')}</label>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {PRESET_NAMES.map(name => (
            <button
              key={name}
              type='button'
              onClick={() => handlePreset(name)}
              className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-transparent hover:bg-muted/50 px-3 py-2 transition-all'
              data-testid={`group-theme-preset-${name}`}
            >
              <span className='text-sm capitalize flex-1 text-left'>{t(name)}</span>
              <span className='flex gap-0.5'>
                {PRESET_SWATCHES.map(token => (
                  <span
                    key={token}
                    className='inline-block h-3 w-3 rounded-full border border-foreground/20'
                    style={{ backgroundColor: swatchColor(themes[name][scheme][token]) }}
                  />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className='mb-4'>
        <label className='text-sm font-medium mb-2 block'>{t('Editing colors for')}</label>
        <div className='inline-flex rounded-lg border-2 border-foreground/20 p-0.5' role='group'>
          {COLOR_SCHEMES.map(value => (
            <button
              key={value}
              type='button'
              aria-pressed={scheme === value}
              onClick={() => setScheme(value)}
              className={cn('px-4 py-1 rounded-md text-sm', scheme === value ? 'bg-selected text-foreground' : 'hover:bg-muted')}
            >
              {schemeLabel(value)}
              {issues[value].length > 0 && <AlertTriangle className='inline h-3 w-3 ml-1 text-destructive' />}
            </button>
          ))}
        </div>
        {previewingOtherScheme && (
          <p className='text-xs text-foreground/60 mt-2'>
            {t('The page is showing this color scheme while you edit it. Your own light or dark setting is not changed.')}
          </p>
        )}
        {issues[otherScheme].length > 0 && (
          <p className='text-xs text-destructive mt-2'>
            {t('Contrast warnings in {{scheme}}: {{count}}', { scheme: schemeLabel(otherScheme), count: issues[otherScheme].length })}
          </p>
        )}
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div className='flex flex-col gap-3'>
          {THEME_ROLES.map(role => {
            const [label, hint] = ROLE_LABELS[role]
            const inputId = `group-theme-${role}`
            return (
              <div key={role} data-testid={`group-theme-role-${role}`}>
                <div className='flex items-center gap-3'>
                  <input
                    id={inputId}
                    type='color'
                    value={hslTripleToHex(roleColors[role]) || '#000000'}
                    onChange={e => {
                      const triple = hexToHslTriple(e.target.value)
                      if (triple) edit(setRoleColor(draft, scheme, role, triple))
                    }}
                    className='h-9 w-12 cursor-pointer rounded border border-foreground/20 bg-transparent p-0.5'
                  />
                  <label htmlFor={inputId} className='flex flex-col'>
                    <span className='text-sm font-medium'>{t(label)}</span>
                    <span className='text-xs text-foreground/60'>{t(hint)}</span>
                  </label>
                </div>
                {issuesByRole(role).map(issue => (
                  <ContrastWarning key={`${issue.text}-${issue.surface}`} issue={issue} />
                ))}
              </div>
            )
          })}
          {otherIssues.map(issue => (
            <ContrastWarning key={`${issue.text}-${issue.surface}`} issue={issue} />
          ))}
        </div>

        <div className='flex flex-col gap-4'>
          <div>
            <label className='text-sm font-medium mb-2 block'>{t('Preview')}</label>
            <GroupThemePreview draft={draft} scheme={scheme} />
          </div>
          <div>
            <label className='text-sm font-medium mb-2 block'>{t('Corner radius')}</label>
            <div className='flex flex-wrap gap-2' role='group'>
              {RADIUS_OPTIONS.map(option => (
                <button
                  key={option}
                  type='button'
                  aria-pressed={radius === option}
                  onClick={() => edit(setRadius(draft, option))}
                  className={cn(
                    'flex flex-col items-center gap-1 border-2 border-foreground/20 hover:border-foreground/50 px-2 py-1 text-xs rounded-md',
                    radius === option && 'border-selected bg-selected/10'
                  )}
                >
                  <span
                    className='block h-5 w-8 border-2 border-foreground/60 bg-card'
                    style={{ borderRadius: GROUP_THEME_RADII[option] }}
                  />
                  {t(RADIUS_LABELS[option])}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className='text-sm font-medium mb-2 block'>{t('Border width')}</label>
            <div className='flex flex-wrap gap-2' role='group'>
              {BORDER_WIDTH_OPTIONS.map(option => (
                <button
                  key={option}
                  type='button'
                  aria-pressed={borderWidth === option}
                  data-testid={`group-theme-border-width-${option}`}
                  onClick={() => edit(setBorderWidth(draft, option))}
                  className={cn(
                    'flex flex-col items-center gap-1 border-2 border-foreground/20 hover:border-foreground/50 px-2 py-1 text-xs rounded-md',
                    borderWidth === option && 'border-selected bg-selected/10'
                  )}
                >
                  <span
                    className='block h-5 w-8 rounded-sm border-solid border-foreground/60 bg-card'
                    style={{ borderWidth: GROUP_THEME_BORDER_WIDTHS[option] }}
                  />
                  {t(BORDER_WIDTH_LABELS[option])}
                </button>
              ))}
            </div>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {FONT_FIELDS.map(({ key, label, defaultLabel }) => {
              const value = draft[key] || ''
              const options = value && !fontFamilies.includes(value) ? [value, ...fontFamilies] : fontFamilies
              return (
                <div key={key}>
                  <label htmlFor={`group-theme-${key}`} className='text-sm font-medium mb-2 block'>{t(label)}</label>
                  <select
                    id={`group-theme-${key}`}
                    data-testid={`group-theme-${key}`}
                    value={value}
                    onChange={event => edit(setFont(draft, key, event.target.value))}
                    className='w-full rounded-md border-2 border-foreground/20 bg-input text-foreground px-2 py-1 text-sm'
                  >
                    <option value=''>{t(defaultLabel)}</option>
                    {options.map(family => <option key={family} value={family}>{family}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className='mt-6 flex flex-col gap-3 rounded-lg border-2 border-foreground/10 p-4'>
        {dirty && (
          <p className='text-sm font-medium text-foreground m-0'>{t('Previewing unsaved changes on this page.')}</p>
        )}
        {!valid && (
          <p className='text-sm text-destructive m-0'>{t('This theme cannot be saved because it contains invalid values.')}</p>
        )}
        {dirty && issueCount > 0 && (
          <div className='flex flex-col gap-2'>
            <p className='text-sm text-destructive m-0'>
              {t('Some text is hard to read with these colors. Fix the warnings, or save anyway.')}
            </p>
            <label className='flex items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={override}
                onChange={e => setOverride(e.target.checked)}
              />
              {t('Save anyway, despite the contrast warnings')}
            </label>
          </div>
        )}
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={handleSave}
            disabled={!canSave}
            className='rounded-md bg-foreground text-background px-3 py-1 text-sm font-bold disabled:opacity-50'
          >
            {saving ? t('Saving...') : t('Save theme')}
          </button>
          <button
            type='button'
            onClick={handleRevert}
            disabled={!dirty || saving}
            className='rounded-md border-2 border-foreground/20 px-3 py-1 text-sm disabled:opacity-50'
          >
            {t('Revert to last saved')}
          </button>
          <button
            type='button'
            onClick={handleReset}
            disabled={!saved || saving}
            className='rounded-md border-2 border-foreground/20 px-3 py-1 text-sm disabled:opacity-50'
          >
            {t('Reset to default')}
          </button>
        </div>
        {status && (
          <p
            role={status.type === 'error' ? 'alert' : 'status'}
            className={cn('text-sm m-0', status.type === 'error' ? 'text-destructive' : 'text-foreground/70')}
          >
            {status.message}
          </p>
        )}
      </div>
    </section>
  )
}
