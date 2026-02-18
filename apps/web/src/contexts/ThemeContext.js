import React, { createContext, useContext, useEffect, useState } from 'react'
import { themes, defaultTheme } from '../themes'

const ThemeContext = createContext()

const THEME_STORAGE_KEY = 'hylo-theme'
const COLOR_SCHEME_STORAGE_KEY = 'hylo-color-scheme'

// Theme migration map for handling renamed themes
const THEME_MIGRATIONS = {
}

export function ThemeProvider ({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    // Handle theme migrations and invalid themes
    if (stored) {
      // Check if this is an old theme name that needs migration
      if (THEME_MIGRATIONS[stored]) {
        const migratedTheme = THEME_MIGRATIONS[stored]
        window.localStorage.setItem(THEME_STORAGE_KEY, migratedTheme)
        return migratedTheme
      }
      // Check if the stored theme exists in our themes
      if (themes[stored]) {
        return stored
      }
    }
    return defaultTheme
  })

  const [colorScheme, setColorScheme] = useState(() => {
    const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
    return stored || 'auto'
  })

  const [systemColorScheme, setSystemColorScheme] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      setSystemColorScheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Get the effective color scheme based on user preference and system setting
  const effectiveColorScheme = colorScheme === 'auto' ? systemColorScheme : colorScheme

  useEffect(() => {
    // Ensure we have a valid theme
    const theme = themes[currentTheme]?.[effectiveColorScheme] || themes[defaultTheme][effectiveColorScheme]

    // Apply theme CSS variables
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value)
    })

    // Update root class for dark mode
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(effectiveColorScheme)

    // Save preferences
    window.localStorage.setItem(THEME_STORAGE_KEY, currentTheme)
    if (colorScheme !== 'auto') {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme)
    } else {
      window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY)
    }
  }, [currentTheme, colorScheme, effectiveColorScheme])

  const value = {
    currentTheme,
    setCurrentTheme,
    colorScheme,
    setColorScheme,
    effectiveColorScheme,
    availableThemes: Object.keys(themes)
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme () {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
