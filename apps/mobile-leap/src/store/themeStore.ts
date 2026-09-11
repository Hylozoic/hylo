import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getThemeColors, DEFAULT_THEME, DEFAULT_COLOR_SCHEME } from '../style/themes'

const THEME_STORAGE_KEY = 'hylo-native-theme'
const COLOR_SCHEME_STORAGE_KEY = 'hylo-native-color-scheme'

type ThemeState = {
  themeName: string
  colorScheme: string
  backgroundColor: string
  foregroundColor: string
  setTheme: (themeName: string, colorScheme: string) => void
  hydrate: () => Promise<void>
}

const defaultColors = getThemeColors(DEFAULT_THEME, DEFAULT_COLOR_SCHEME)

const useThemeStore = create<ThemeState>((set) => ({
  themeName: DEFAULT_THEME,
  colorScheme: DEFAULT_COLOR_SCHEME,
  ...defaultColors,

  setTheme: (themeName, colorScheme) => {
    const colors = getThemeColors(themeName, colorScheme)
    set({ themeName, colorScheme, ...colors })
    AsyncStorage.setItem(THEME_STORAGE_KEY, themeName).catch(() => {})
    AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme).catch(() => {})
  },

  hydrate: async () => {
    try {
      const [storedTheme, storedScheme] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
      ])
      const themeName = storedTheme || DEFAULT_THEME
      const colorScheme = storedScheme || DEFAULT_COLOR_SCHEME
      const colors = getThemeColors(themeName, colorScheme)
      set({ themeName, colorScheme, ...colors })
    } catch {
      // fall back to defaults
    }
  }
}))

export default useThemeStore
