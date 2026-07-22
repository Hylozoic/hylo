import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { isDrawerNavLayout } from 'util/mobile'

function canNavigateBack () {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0
}

function handleGroupSettingsBack ({
  dispatch,
  navigate,
  groupSlug,
  pathname,
  oneColumnGroup
}) {
  if (!isDrawerNavLayout(window.innerWidth) || !groupSlug) return false
  if (!pathname.startsWith(`/groups/${groupSlug}/settings`)) return false

  const isSettingsRoot = pathname === `/groups/${groupSlug}/settings` ||
    pathname === `/groups/${groupSlug}/settings/`

  if (isSettingsRoot) {
    navigate(`/groups/${groupSlug}`)
    if (!oneColumnGroup) {
      dispatch(toggleNavMenu(true))
    }
  } else {
    navigate(`/groups/${groupSlug}/settings`)
  }
  return true
}

/**
 * Shared back navigation for drawer-nav mobile layout (header chevron + Android hardware back).
 * Returns true when the action consumed the back press.
 */
export function performMobileNavBack ({
  dispatch,
  navigate,
  headerDetails = {},
  previousLocation,
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  groupSlug,
  oneColumnGroup = false
}) {
  const { backButton, backTo, mobileBackButton, centered } = headerDetails

  if (handleGroupSettingsBack({ dispatch, navigate, groupSlug, pathname, oneColumnGroup })) {
    return true
  }

  // Simple (one-column) groups render the sidebar inline on phone — no drawer to toggle.
  if (isDrawerNavLayout(window.innerWidth) && !mobileBackButton && !backButton && !oneColumnGroup) {
    dispatch(toggleNavMenu())
    return true
  }

  if (backTo) {
    navigate(backTo)
    return true
  }

  if (centered) {
    navigate(previousLocation || '/')
    return true
  }

  if (canNavigateBack()) {
    navigate(-1)
    return true
  }

  return false
}

export { canNavigateBack }
