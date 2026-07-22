import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import getMe from 'store/selectors/getMe'
import {
  DEFAULT_COLOR_SCHEME,
  getSystemColorScheme,
  resolveEffectiveColorScheme
} from 'util/appearance'

/**
 * Resolves the user's colorScheme setting against system prefers-color-scheme.
 */
export default function useAppearance () {
  const currentUser = useSelector(getMe)
  const colorScheme = currentUser?.settings?.colorScheme || DEFAULT_COLOR_SCHEME
  const [systemColorScheme, setSystemColorScheme] = useState(getSystemColorScheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      setSystemColorScheme(e.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return {
    colorScheme,
    effectiveColorScheme: resolveEffectiveColorScheme(colorScheme, systemColorScheme)
  }
}
