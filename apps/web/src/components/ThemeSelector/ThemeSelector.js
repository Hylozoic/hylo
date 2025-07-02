import React from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun, Palette, Trees, Waves, Mountain, Snowflake, TreePalm, Monitor } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { cn } from 'util/index'

const themeIcons = {
  base: Palette,
  forest: Trees,
  ocean: Waves,
  desert: Mountain,
  snow: Snowflake,
  jungle: TreePalm
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

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className='flex items-center justify-between'>
        <label className='text-sm font-medium'>{t('Color Scheme')}</label>
        <div className='flex items-center gap-2 rounded-lg border p-1'>
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
        <label className='text-sm font-medium'>{t('Theme')}</label>
        <div className='grid grid-cols-3 gap-2'>
          {availableThemes.map(theme => {
            const ThemeIcon = themeIcons[theme] || Palette
            return (
              <button
                key={theme}
                onClick={() => setCurrentTheme(theme)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border-2 border-foreground/20 hover:border-foreground/100 scale-100 bg-transparent hover:scale-105 p-2 transition-colors transition-all',
                  currentTheme === theme
                    ? 'bg-selected text-selected-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <ThemeIcon className='h-4 w-4' />
                <span className='text-sm capitalize'>{t(theme)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
} 