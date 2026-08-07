import React, { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Moon, Sun, Palette, Trees, Waves, Mountain, Snowflake, TreePalm, Monitor, Flower2, Leaf, Gem, PanelLeft, AppWindow, Layers, List, LayoutGrid, Columns2, LayoutPanelTop } from 'lucide-react'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useAppearance from 'hooks/useAppearance'
import { themes } from '../../../themes'
import { cn } from 'util/index'
import getMe from 'store/selectors/getMe'
import updateUserSettings from 'store/actions/updateUserSettings'
import { availableThemes, DEFAULT_GLOBAL_NAV_STYLE, getAppearanceFromSettings } from 'util/appearance'
import {
  NAV_STYLE_GROUP_DEFAULT,
  NAV_STYLE_ONE_COLUMN,
  NAV_STYLE_TWO_COLUMN
} from 'util/navigationLayout'

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

/**
 * User appearance settings: color mode/theme and navigation preferences.
 */
export default function AppearanceTab () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const { setHeaderDetails } = useViewHeader()
  const { colorScheme, effectiveColorScheme } = useAppearance()
  const { theme } = getAppearanceFromSettings(currentUser?.settings)
  const globalNavStyle = currentUser?.settings?.globalNavStyle === 'tabs' ? 'tabs' : DEFAULT_GLOBAL_NAV_STYLE
  const stackGroups = currentUser?.settings?.stackGroups === true
  const groupNavStyle = currentUser?.settings?.groupNavStyle || NAV_STYLE_GROUP_DEFAULT
  const resolvedScheme = useMemo(() => effectiveColorScheme, [effectiveColorScheme])

  useEffect(() => {
    setHeaderDetails({
      title: t('Appearance Settings'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  /**
   * Persists one or more appearance settings on the current user.
   */
  const handleSettingChange = (settings) => {
    dispatch(updateUserSettings({ settings }))
  }

  return (
    <div className='p-4'>
      <p className='mb-6 text-foreground/70'>
        {t('Customize the look and feel of Hylo by choosing your preferred color mode and color theme.')}
      </p>

      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium'>{t('Color Mode')}</label>
          <div className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 p-1'>
            <button
              onClick={() => handleSettingChange({ colorScheme: 'auto' })}
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
              onClick={() => handleSettingChange({ colorScheme: 'light' })}
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
              onClick={() => handleSettingChange({ colorScheme: 'dark' })}
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

        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium'>{t('Global Navigation')}</label>
          <div className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 p-1'>
            <button
              onClick={() => handleSettingChange({ globalNavStyle: 'sidebar' })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                globalNavStyle === 'sidebar'
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Sidebar')}
              title={t('Sidebar')}
            >
              <PanelLeft className='h-4 w-4' />
              <span className='text-xs'>{t('Sidebar')}</span>
            </button>
            <button
              onClick={() => handleSettingChange({ globalNavStyle: 'tabs' })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                globalNavStyle === 'tabs'
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Topbar')}
              title={t('Topbar')}
            >
              <AppWindow className='h-4 w-4' />
              <span className='text-xs'>{t('Topbar')}</span>
            </button>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium'>{t('Group Nav Stacking')}</label>
          <div className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 p-1'>
            <button
              onClick={() => handleSettingChange({ stackGroups: false })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                !stackGroups
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Flat')}
              title={t('Show every group as its own item')}
            >
              <List className='h-4 w-4' />
              <span className='text-xs'>{t('Flat')}</span>
            </button>
            <button
              onClick={() => handleSettingChange({ stackGroups: true })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                stackGroups
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Stacked')}
              title={t('Show subgroups stacked on their parent group')}
            >
              <Layers className='h-4 w-4' />
              <span className='text-xs'>{t('Stacked')}</span>
            </button>
          </div>
        </div>

        <div className='flex items-center justify-between gap-3'>
          <label className='text-sm font-medium shrink-0'>{t('Group Menu Style')}</label>
          <div className='flex items-center gap-2 rounded-lg border-2 border-foreground/20 p-1 flex-wrap justify-end'>
            <button
              onClick={() => handleSettingChange({ groupNavStyle: NAV_STYLE_GROUP_DEFAULT })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                groupNavStyle === NAV_STYLE_GROUP_DEFAULT || !groupNavStyle
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Group Default')}
              title={t('Use each group layout setting')}
            >
              <LayoutPanelTop className='h-4 w-4' />
              <span className='text-xs'>{t('Group Default')}</span>
            </button>
            <button
              onClick={() => handleSettingChange({ groupNavStyle: NAV_STYLE_TWO_COLUMN })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                groupNavStyle === NAV_STYLE_TWO_COLUMN
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Side Menu')}
              title={t('Always show the side menu beside the view')}
            >
              <Columns2 className='h-4 w-4' />
              <span className='text-xs'>{t('Side Menu')}</span>
            </button>
            <button
              onClick={() => handleSettingChange({ groupNavStyle: NAV_STYLE_ONE_COLUMN })}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5',
                groupNavStyle === NAV_STYLE_ONE_COLUMN
                  ? 'bg-selected text-selected-foreground'
                  : 'hover:bg-muted'
              )}
              aria-label={t('Card Menu')}
              title={t('Always use the full-screen card menu')}
            >
              <LayoutGrid className='h-4 w-4' />
              <span className='text-xs'>{t('Card Menu')}</span>
            </button>
          </div>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>{t('Color Theme')}</label>
          <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
            {availableThemes.map(themeName => {
              const ThemeIcon = themeIcons[themeName] || Palette
              const themeColors = themes[themeName]?.[resolvedScheme] || {}

              return (
                <button
                  key={themeName}
                  onClick={() => handleSettingChange({ theme: themeName })}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 border-foreground/20 hover:border-foreground/50 bg-transparent hover:bg-muted/50 px-3 py-2 transition-all',
                    theme === themeName && 'border-selected bg-selected/10'
                  )}
                >
                  <ThemeIcon className='h-4 w-4 shrink-0' />
                  <span className='text-sm capitalize flex-1 text-left'>{t(themeName)}</span>
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
    </div>
  )
}
