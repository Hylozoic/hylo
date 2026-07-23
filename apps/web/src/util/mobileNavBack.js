import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { isDrawerNavLayout } from 'util/mobile'

function canNavigateBack () {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0
}

/**
 * Shared back navigation for drawer-nav mobile layout (header chevron + Android hardware back).
 * Returns true when the action consumed the back press.
 */
export function performMobileNavBack ({
  dispatch,
  navigate,
  headerDetails = {},
  previousLocation
}) {
  const { backButton, backTo, mobileBackButton, centered } = headerDetails

  if (isDrawerNavLayout(window.innerWidth) && !mobileBackButton && !backButton) {
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
