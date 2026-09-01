import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { isDrawerNavLayout } from 'util/mobile'

// Sibling routes of a space's lone home view. The home view itself should leave
// the space; these screens go to the home view first.
const SECONDARY_SINGLE_VIEW_SEGMENTS = ['members', 'about', 'welcome', 'requests', 'settings', 'moderation']

/**
 * Returns true when the browser history stack has a prior entry we can pop.
 */
function canNavigateBack () {
  return typeof window.history.state?.idx === 'number' && window.history.state.idx > 0
}

/**
 * True when this path is a secondary screen inside a space (members, about, …),
 * not the space's home view or a child of that home view.
 */
export function isSecondarySingleViewPath (path, spaceBase) {
  if (!spaceBase || !path?.startsWith(`${spaceBase}/`)) return false
  const firstSegment = path.slice(spaceBase.length + 1).split('/')[0]
  return SECONDARY_SINGLE_VIEW_SEGMENTS.includes(firstSegment)
}

/**
 * Shared back navigation for the header chevron and Android hardware back.
 * Returns true when the action consumed the back press.
 */
export function performMobileNavBack ({
  dispatch,
  navigate,
  headerDetails = {},
  previousLocation,
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  fromMoreSpaces = false,
  groupSlug,
  spaceSlug,
  context,
  isOneColumnGroup = false,
  isOneColumnContext = false,
  oneColumn = false,
  isSingleViewSpace = false,
  hasSpaceMenu = false,
  spaceHomePath
}) {
  const { backButton, backTo, mobileBackButton, centered } = headerDetails
  const path = pathname.replace(/\/$/, '')
  const hasExplicitBack = Boolean(backButton || mobileBackButton || backTo)

  // Phone settings use master-detail navigation:
  // /settings/<tab>  → back to /settings (the menu)
  // /settings (root) → exit settings, return to the group home. For normal groups
  //                    also open the drawer so the user lands on the context menu
  //                    (widget list) instead of the underlying active view.
  if (isDrawerNavLayout(window.innerWidth) && groupSlug && pathname.startsWith(`/groups/${groupSlug}/settings`)) {
    const isSettingsRoot = pathname === `/groups/${groupSlug}/settings` ||
      pathname === `/groups/${groupSlug}/settings/`
    if (isSettingsRoot) {
      navigate(`/groups/${groupSlug}`)
      if (!isOneColumnGroup) {
        dispatch(toggleNavMenu(true))
      }
    } else {
      navigate(`/groups/${groupSlug}/settings`)
    }
    return true
  }

  // Single-view spaces open straight into their lone (home) view. Back from
  // any secondary view (members, about, …) returns to that home view;
  // back from the home view itself opens the parent group menu.
  if (isSingleViewSpace && !hasExplicitBack) {
    const spaceBase = `/groups/${groupSlug}/spaces/${spaceSlug}`
    if (spaceHomePath && isSecondarySingleViewPath(path, spaceBase)) {
      navigate(spaceHomePath)
      return true
    }
    if (isOneColumnGroup) {
      navigate(`/groups/${groupSlug}`)
    } else {
      dispatch(toggleNavMenu(true))
    }
    return true
  }

  // One-column groups: back from a space view → space menu; from a group view → group menu.
  // Single-view spaces have no space menu — the index just redirects to the home
  // view, so going there looks like the chevron did nothing.
  if (isOneColumnGroup && groupSlug && !hasExplicitBack) {
    const groupHome = `/groups/${groupSlug}`
    if (spaceSlug) {
      const spaceMenu = `/groups/${groupSlug}/spaces/${spaceSlug}`
      if (hasSpaceMenu && path !== spaceMenu) {
        navigate(spaceMenu)
        return true
      }
      if (fromMoreSpaces) {
        navigate(`${groupHome}/more-spaces`)
        return true
      }
      navigate(groupHome)
      return true
    }
    if (path !== groupHome && path !== `${groupHome}/more-spaces`) {
      navigate(groupHome)
      return true
    }
    if (path === `${groupHome}/more-spaces`) {
      navigate(groupHome)
      return true
    }
  }

  // Card-menu My/All/Public: back from a view returns to that context's menu home.
  if (isOneColumnContext && !hasExplicitBack) {
    const contextHome = `/${context}`
    if (path !== contextHome) {
      navigate(contextHome)
      return true
    }
  }

  // Card-menu layouts render the sidebar inline on phone too — there's no
  // drawer to toggle, so the chevron should navigate back instead.
  if (isDrawerNavLayout(window.innerWidth) && !mobileBackButton && !backButton && !oneColumn) {
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
