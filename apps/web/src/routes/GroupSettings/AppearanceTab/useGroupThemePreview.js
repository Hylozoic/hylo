import { useEffect, useMemo } from 'react'
import { defaultTheme } from '../../../themes'
import { appThemeCssVars, groupThemeCssVars } from 'util/groupTheme'

export const PREVIEW_STYLE_ID = 'group-theme-preview'

// The wrapper AuthLayoutRouter puts around the global nav to keep the viewer's theme
const GLOBAL_NAV_SCOPE = '[data-testid="global-nav-theme-scope"]'

function cssRule (selector, vars) {
  const declarations = Object.entries(vars)
    .map(([name, value]) => `${name}: ${value} !important;`)
    .join(' ')
  return `${selector} { ${declarations} }`
}

/**
 * The CSS that previews a draft theme across the page, or null for no preview.
 *
 * The draft's tokens come from groupThemeCssVars, the same path useGroupTheme
 * uses, and apply to <body>. They go in a stylesheet with !important instead of
 * on body's inline style, which useGroupTheme owns: the two never write the same
 * properties, so neither can wipe out the other, and removing the stylesheet
 * brings back whatever useGroupTheme has set (the saved theme, or nothing).
 */
export function previewCss (draft, colorScheme, viewerThemeName) {
  // A draft with nothing in it previews the default look, over any saved theme
  const groupVars = groupThemeCssVars(draft, colorScheme) || appThemeCssVars(defaultTheme, colorScheme)
  return [
    cssRule('body', groupVars),
    // Keep the global nav in the viewer's theme, even when the group has no saved theme yet
    cssRule(GLOBAL_NAV_SCOPE, appThemeCssVars(viewerThemeName, colorScheme))
  ].join('\n')
}

/**
 * Previews a draft group theme on the page while `active`, and removes every
 * trace of it when inactive or unmounted.
 */
export default function useGroupThemePreview ({ draft, active, colorScheme, viewerThemeName }) {
  const css = useMemo(
    () => active ? previewCss(draft, colorScheme, viewerThemeName) : null,
    [active, JSON.stringify(draft || null), colorScheme, viewerThemeName]
  )

  useEffect(() => {
    if (!css) return
    const style = document.createElement('style')
    style.id = PREVIEW_STYLE_ID
    style.textContent = css
    document.head.appendChild(style)
    return () => style.remove()
  }, [css])
}
