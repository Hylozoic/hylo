import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { ThemeProviderContext } from './useTheme'

const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  SYSTEM: 'system'
}

export function ThemeProvider ({
  children,
  defaultTheme = 'system',
  storageKey = 'hylo-ui-theme',
  ...props
}) {
  const [theme, setTheme] = useState(
    () => (localStorage.getItem(storageKey)) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    }
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
  defaultTheme: PropTypes.oneOf(Object.values(THEMES)),
  storageKey: PropTypes.string
}
