import { useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import useAppearance from 'hooks/useAppearance'
import getMe from 'store/selectors/getMe'
import { getAppearanceFromSettings } from 'util/appearance'
import { appThemeCssVars, groupThemeCssVars, loadGroupThemeFonts } from 'util/groupTheme'

/**
 * Applies a group's theme (group.settings.theme) while that group is on screen.
 *
 * The group's tokens are set on <body>, so the group menu, the main column and
 * anything rendered in a portal (dialogs, popovers, dropdowns) all pick them up.
 * The viewer's own theme stays on <html>, set by AppearanceSync, and comes back
 * as soon as the group's tokens are removed.
 *
 * Returns:
 *   hasGroupTheme   whether the group has a usable theme
 *   globalNavStyle  CSS variables that restore the viewer's theme, for the
 *                   global nav, or undefined when no group theme is active
 */
export default function useGroupTheme (group) {
  const currentUser = useSelector(getMe)
  const { theme: userThemeName } = getAppearanceFromSettings(currentUser?.settings)
  const { effectiveColorScheme } = useAppearance()

  // Settings objects are replaced on every fetch, so key the memo on the content
  const themeKey = JSON.stringify(group?.settings?.theme || null)

  const groupVars = useMemo(
    () => groupThemeCssVars(JSON.parse(themeKey), effectiveColorScheme),
    [themeKey, effectiveColorScheme]
  )

  useEffect(() => {
    if (!groupVars) return
    loadGroupThemeFonts(JSON.parse(themeKey))
    const { style } = document.body
    Object.entries(groupVars).forEach(([name, value]) => style.setProperty(name, value))
    return () => {
      Object.keys(groupVars).forEach(name => style.removeProperty(name))
    }
  }, [groupVars])

  const globalNavStyle = useMemo(
    () => groupVars ? appThemeCssVars(userThemeName, effectiveColorScheme) : undefined,
    [groupVars, userThemeName, effectiveColorScheme]
  )

  return { hasGroupTheme: !!groupVars, globalNavStyle }
}
