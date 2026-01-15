import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Palette, Trees, Waves, Mountain, Snowflake, TreePalm, Monitor, Flower2, Leaf, Gem } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { themes } from '../../themes'
import { cn } from 'util/index'

const themeIcons = {
  default: Palette,
  forest: Trees,
  ocean: Waves,
  desert: Mountain,
  snow: Snowflake,
  jungle: TreePalm,
  blossom: Flower2,
  fall: Leaf,
  stone: Gem
}

// Colors to display as swatches for each theme
const swatchColors = ['background', 'accent', 'selected', 'focus', 'theme-highlight']

/**
 * Converts HSL string (e.g., "120 15% 92%") to CSS hsl() format
 */
function hslToCss (hslString) {
  if (!hslString) return 'transparent'
  const parts = hslString.trim().split(/\s+/)
  if (parts.length >= 3) {
    return `hsl(${parts[0]} ${parts[1]} ${parts[2]})`
  }
  return 'transparent'
}

/**
 * Gets the resolved color scheme based on user preference and system setting
 */
function getResolvedColorScheme (colorScheme) {
  if (colorScheme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return colorScheme
}

/**
 * Renders a single color swatch
 */
function ColorSwatch ({ color, title }) {
  return (
    <div
      className='h-4 w-4 rounded-sm border border-foreground/20 shrink-0'
      style={{ backgroundColor: color }}
      title={title}
    />
  )
}

export default function ThemeSelector ({ className }) {
  const { t } = useTranslation()
  const {
    currentTheme,
    setCurrentTheme,
    colorScheme,
    setColorScheme,
    availableThemes
  } = useTheme()

  const orderedThemes = useMemo(() => {
    const priority = ['default', 'stone']
    const seen = new Set()
    const ordered = []

    priority.forEach(theme => {
      if (availableThemes.includes(theme)) {
        ordered.push(theme)
        seen.add(theme)
      }
    })

    availableThemes.forEach(theme => {
      if (!seen.has(theme)) {
        ordered.push(theme)
      }
    })

    return ordered
  }, [availableThemes])

  // Get the resolved color scheme for displaying swatches
  const resolvedScheme = useMemo(() => getResolvedColorScheme(colorScheme), [colorScheme])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className='flex items-center justify-between'>
        <label className='text-sm font-medium'>{t('Display Mode')}</label>
        <div className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 p-1'>
          <button
            onClick={() => setColorScheme('auto')}
            className={cn(
              'p-2 rounded-md transition-colors',
              colorScheme === 'auto'
                ? 'bg-selected text-selected-foreground'
                : 'hover:bg-muted'
            )}
            aria-label={t('Auto')}
          >
            <Monitor className='h-4 w-4' />
          </button>
          <button
            onClick={() => setColorScheme('light')}
            className={cn(
              'p-2 rounded-md transition-colors',
              colorScheme === 'light'
                ? 'bg-selected text-selected-foreground'
                : 'hover:bg-muted'
            )}
            aria-label={t('Light Mode')}
          >
            <Sun className='h-4 w-4' />
          </button>
          <button
            onClick={() => setColorScheme('dark')}
            className={cn(
              'p-2 rounded-md transition-colors',
              colorScheme === 'dark'
                ? 'bg-selected text-selected-foreground'
                : 'hover:bg-muted'
            )}
            aria-label={t('Dark Mode')}
          >
            <Moon className='h-4 w-4' />
          </button>
        </div>
      </div>

      <div className='space-y-2'>
        <label className='text-sm font-medium'>{t('Color Scheme')}</label>
        <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
          {orderedThemes.map(theme => {
            const ThemeIcon = themeIcons[theme] || Palette
            const themeColors = themes[theme]?.[resolvedScheme] || {}

            return (
              <button
                key={theme}
                onClick={() => setCurrentTheme(theme)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-transparent hover:bg-muted/50 px-3 py-2 transition-all',
                  currentTheme === theme && 'border-selected bg-selected/10'
                )}
              >
                <ThemeIcon className='h-4 w-4 shrink-0' />
                <span className='text-sm capitalize flex-1 text-left'>{t(theme)}</span>
                <div className='flex items-center gap-1'>
                  {swatchColors.map(colorKey => (
                    <ColorSwatch
                      key={colorKey}
                      color={hslToCss(themeColors[colorKey])}
                      title={colorKey}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
