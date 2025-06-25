import React, { createContext, useContext, useEffect, useState } from 'react'
import { themes, defaultTheme } from '../themes'

const ThemeContext = createContext()

const THEME_STORAGE_KEY = 'hylo-theme'
const COLOR_SCHEME_STORAGE_KEY = 'hylo-color-scheme'

// Theme migration map for handling renamed themes
const THEME_MIGRATIONS = {
  nature: 'forest'
}

export function ThemeProvider ({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    // Handle theme migrations and invalid themes
    if (stored) {
      // Check if this is an old theme name that needs migration
      if (THEME_MIGRATIONS[stored]) {
        const migratedTheme = THEME_MIGRATIONS[stored]
        localStorage.setItem(THEME_STORAGE_KEY, migratedTheme)
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
    const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
    if (stored) return stored
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    return 'light'
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      if (!localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)) {
        setColorScheme(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    // Ensure we have a valid theme
    const theme = themes[currentTheme]?.[colorScheme] || themes[defaultTheme][colorScheme]
    
    // Apply theme CSS variables
    Object.entries(theme).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--${key}`, value)
    })

    // Update root class for dark mode
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(colorScheme)

    // Save preferences
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme)
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme)
  }, [currentTheme, colorScheme])

  const value = {
    currentTheme,
    setCurrentTheme,
    colorScheme,
    setColorScheme,
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