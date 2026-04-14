/**
 * Zustand store for managing the current theme state on the native side.
 *
 * The theme is set by the web app via a THEME_CHANGE WebView message whenever
 * the user changes their theme or color scheme. The selection is persisted to
 * AsyncStorage so we can show the correct safe-area background color on the
 * next app launch before the WebView finishes loading.
 */
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getThemeColors, DEFAULT_THEME, DEFAULT_COLOR_SCHEME } from 'style/themes'

const THEME_STORAGE_KEY = 'hylo-native-theme'
const COLOR_SCHEME_STORAGE_KEY = 'hylo-native-color-scheme'

const useThemeStore = create((set) => ({
  themeName: DEFAULT_THEME,
  colorScheme: DEFAULT_COLOR_SCHEME,
  ...getThemeColors(DEFAULT_THEME, DEFAULT_COLOR_SCHEME),

  /**
   * Updates theme state and persists to AsyncStorage.
   */
  setTheme: (themeName, colorScheme) => {
    const colors = getThemeColors(themeName, colorScheme)
    set({ themeName, colorScheme, ...colors })

    // Persist asynchronously — fire and forget
    AsyncStorage.setItem(THEME_STORAGE_KEY, themeName).catch(() => {})
    AsyncStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme).catch(() => {})
  },

  /**
   * Hydrates theme state from AsyncStorage on app launch.
   */
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
      // Silently fall back to defaults
    }
  }
}))

export default useThemeStore

