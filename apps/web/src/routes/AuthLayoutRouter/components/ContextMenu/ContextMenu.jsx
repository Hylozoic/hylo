import { isPhoneDevice } from 'util/mobile'
import { get } from 'lodash/fp'
import { ChevronLeft, CircleEllipsis, Info, Pencil, RefreshCw, Settings } from 'lucide-react'
import React, { useEffect, useCallback, useState, useMemo } from 'react'
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'

import {
  ALL_GROUPS_CONTEXT_SLUG,
  MY_CONTEXT_SLUG,
  PUBLIC_CONTEXT_SLUG,
  groupUrl,
  localSpaceSlug,
  spaceHomeUrl,
  spaceUrl,
  addQuerystringToPath,
  personUrl
} from '@hylo/navigation'

import GroupMenuHeader from 'components/GroupMenuHeader'
import MenuLink from './MenuLink'
import GroupViewIcon from './GroupViewIcon'
import useRouteParams from 'hooks/useRouteParams'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews,
  MANAGE_ROUND_VIEW
} from '@hylo/presenters/GroupViewPresenter'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import logout from 'store/actions/logout'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { bgImageStyle, cn } from 'util/index'
import { isOneColumnLayout as resolveIsOneColumnLayout } from 'util/navigationLayout'
import { filterSpaceViewsForMenuVisibility } from 'util/paidSpaceVisibility'

import GroupSettingsMenu from './GroupSettingsMenu'
import ContextMenuOld from './ContextMenuOld'
import MenuRowBackground from './MenuRowBackground'
import { viewCardColor, hueOf } from './viewCardTheme'
import { DEFAULT_BANNER } from 'store/models/Group'
import GroupViewEditList from './GroupViewEditList'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import { menuViewUrl } from './groupViewMenuUrl'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION, RESP_MANAGE_SPACES } from 'store/constants'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import { WebViewMessageTypes } from '@hylo/shared'
import { getMobileAppVersion, sendMessageToWebView } from 'util/webView'

import classes from './ContextMenu.module.scss'

/** Small orange unread dot shown when a view has new posts. */
function UnreadDot () {
  return <span className='w-2 h-2 rounded-full bg-orange-500 shrink-0 ml-1' />
}

const GROUP_VIEW_MENU_ITEM_CLASS = 'flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 mb-[.3rem] w-full transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100'

/** MenuLink overrides when nested inside a styled space row wrapper. */
const GROUP_VIEW_MENU_ITEM_INNER_LINK_CLASS = 'flex-1 flex items-center gap-2 min-w-0 border-0 bg-transparent p-0 mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100 font-inherit'

/** Finds a space menu view / linked group matching the current local spaceSlug. */
function findSpaceForSlug (groupViews, group, parentSlug, spaceSlug) {
  if (!parentSlug || !spaceSlug) return { spaceView: null, spaceGroup: null }

  for (const view of groupViews || []) {
    if (view.type === 'space' && view.linkedGroup) {
      if (localSpaceSlug(parentSlug, view.linkedGroup.slug) === spaceSlug) {
        return { spaceView: view, spaceGroup: view.linkedGroup }
      }
    }
  }

  for (const space of group?.spaces?.items || []) {
    if (localSpaceSlug(parentSlug, space.slug) === spaceSlug) {
      return {
        spaceView: { type: 'space', name: space.name, icon: space.icon, linkedGroup: space },
        spaceGroup: space
      }
    }
  }

  return { spaceView: null, spaceGroup: null }
}

/** Visible menu views for a space (ordered, post-type filtered), optionally with Manage Round. */
function visibleSpaceMenuViews (spaceGroup, { includeManageRound = false } = {}) {
  const spaceViews = (spaceGroup?.groupViews?.items || [])
    .filter(v => v.order != null)
    .filter(v => viewAcceptedByPostTypes(v.type, spaceGroup?.acceptedPostTypes))
  if (includeManageRound && spaceGroup?.fundingRound?.id) {
    return [...spaceViews, MANAGE_ROUND_VIEW]
  }
  return spaceViews
}

/** Renders a single GroupView menu item, including nested space sub-items. */
function GroupViewMenuItem ({
  view,
  parentSlug,
  spaceGroup = null,
  spaceSlug = null
}) {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])
  const myMemberships = useSelector(getMyMemberships)
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_MANAGE_SPACES,
    groupId: view?.linkedGroup?.parentId
  }))

  if (presentedView.type === 'separator') {
    return <hr className='border-foreground/10 my-1' />
  }

  if (presentedView.type === 'text') {
    return (
      <li className='list-none'>
        <p className='text-xs text-foreground/40 px-2 mt-3 mb-1 uppercase tracking-wide'>
          {displayNameForView(presentedView, t, { spaceGroup })}
        </p>
      </li>
    )
  }

  if (presentedView.type === 'logout') {
    const mobileAppVersionLabel = typeof window !== 'undefined' && window.HyloMobileV2
      ? getMobileAppVersion()
      : ''

    const handleLogout = async () => {
      await dispatch(logout())
      if (window.HyloMobileV2) {
        sendMessageToWebView(WebViewMessageTypes.LOGOUT)
      } else {
        dispatch(replace('/login', null))
      }
    }

    return (
      <li className='list-none mt-6'>
        <div className='flex items-center justify-between gap-2 px-2'>
          <button
            type='button'
            onClick={handleLogout}
            className='flex-1 flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-2 opacity-85 hover:opacity-100 text-left'
          >
            <GroupViewIcon view={presentedView} />
            <span className='truncate'>{displayNameForView(presentedView, t, { spaceGroup })}</span>
          </button>
          {mobileAppVersionLabel
            ? <span className='text-xs text-muted-foreground shrink-0 tabular-nums'>v{mobileAppVersionLabel}</span>
            : null}
        </div>
      </li>
    )
  }

  if (presentedView.type === 'space') {
    const linkedSpaceGroup = presentedView.linkedGroup
    const isSpaceMember = Boolean(
      linkedSpaceGroup &&
      myMemberships.some(m => m.group.id === linkedSpaceGroup.id)
    )
    const showManageRound = Boolean(linkedSpaceGroup?.fundingRound?.id && canManageRound)
    const spaceViews = visibleSpaceMenuViews(linkedSpaceGroup)
      .map(v => GroupViewPresenter(v))
    const menuSpaceViews = showManageRound
      ? [...spaceViews, GroupViewPresenter(MANAGE_ROUND_VIEW)]
      : spaceViews
    const hasMultipleSpaceViews = menuSpaceViews.length > 1
    const singleSpaceView = menuSpaceViews.length === 1 ? menuSpaceViews[0] : null
    const spaceUnread = spaceViews.some(v => v.newPostCount > 0)
    const spaceHome = linkedSpaceGroup ? spaceHomeUrl(parentSlug, linkedSpaceGroup) : null
    // Single-view spaces open that view directly; multi-view spaces nest under the row when active.
    const spaceLink = singleSpaceView && isSpaceMember
      ? menuViewUrl(parentSlug, singleSpaceView, linkedSpaceGroup)
      : spaceHome
    const isSpaceActive = Boolean(
      spaceSlug &&
      linkedSpaceGroup &&
      localSpaceSlug(parentSlug, linkedSpaceGroup.slug) === spaceSlug
    )
    const isExpanded = isSpaceMember && isSpaceActive && hasMultipleSpaceViews
    const aboutUrl = linkedSpaceGroup
      ? spaceUrl(parentSlug, localSpaceSlug(parentSlug, linkedSpaceGroup.slug), '/about')
      : null

    // Active space rows reveal the space's banner photo (uploaded ones only);
    // spaces without a banner fall back to the tinted icon texture.
    const spaceBannerUrl = linkedSpaceGroup?.bannerUrl && linkedSpaceGroup.bannerUrl !== DEFAULT_BANNER
      ? linkedSpaceGroup.bannerUrl
      : null
    const spaceHue = hueOf(viewCardColor(presentedView))

    return (
      <li className='list-none'>
        <div
          className={cn(
            GROUP_VIEW_MENU_ITEM_CLASS,
            'group relative overflow-hidden',
            isSpaceActive && 'opacity-100 font-bold'
          )}
          style={isSpaceActive
            ? { borderColor: spaceBannerUrl ? 'hsl(0 0% 100% / 0.35)' : `hsl(${spaceHue} 45% 42%)` }
            : undefined}
        >
          <MenuRowBackground
            view={presentedView}
            bannerUrl={spaceBannerUrl}
            className={cn('transition-opacity duration-200', isSpaceActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          />
          <MenuLink
            to={spaceLink}
            isActive={false}
            className={cn(
              GROUP_VIEW_MENU_ITEM_INNER_LINK_CLASS,
              'relative z-10 transition-colors duration-200',
              isSpaceActive
                ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
                : 'group-hover:text-white group-hover:[text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
            )}
          >
            <GroupViewIcon view={presentedView} />
            <span className='truncate flex-1'>{displayNameForView(presentedView, t, { spaceGroup })}</span>
            {spaceUnread && <UnreadDot />}
          </MenuLink>
          {aboutUrl && (
            <MenuLink
              to={aboutUrl}
              isActive={false}
              className={cn(
                'shrink-0 p-1 pr-1 text-foreground/50 hover:text-foreground border-0 bg-transparent mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100',
                'relative z-10 transition-colors duration-200',
                isSpaceActive ? 'text-white/80 hover:text-white' : 'group-hover:text-white/80'
              )}
            >
              <Info className='w-4 h-4' aria-hidden='true' />
              <span className='sr-only'>{t('About')}</span>
            </MenuLink>
          )}
        </div>
        {isExpanded && (
          <ul className='pl-4 mt-1'>
            {menuSpaceViews.map(subView => (
              <GroupViewMenuItem
                key={subView.id}
                view={subView}
                parentSlug={parentSlug}
                spaceGroup={linkedSpaceGroup}
                spaceSlug={spaceSlug}
              />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const url = menuViewUrl(parentSlug, presentedView, spaceGroup)
  const hasUnread = presentedView.newPostCount > 0
  const isExternal = presentedView.type === 'link' && url && /^https?:\/\//.test(url)
  // The selected row reveals a postType-tinted icon-texture background,
  // mirroring the one-column dashboard cards.
  const isRowActive = Boolean(!isExternal && url && (location.pathname === url || location.pathname.startsWith(`${url}/`)))
  const rowHue = hueOf(viewCardColor(presentedView))

  return (
    <li className='list-none'>
      <MenuLink
        to={isExternal ? null : url}
        externalLink={isExternal ? url : null}
        isActive={isRowActive}
        className={cn(GROUP_VIEW_MENU_ITEM_CLASS, 'group relative overflow-hidden')}
        style={isRowActive ? { borderColor: `hsl(${rowHue} 45% 42%)` } : undefined}
      >
        <MenuRowBackground
          view={presentedView}
          className={cn('transition-opacity duration-200', isRowActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        />
        <span className={cn(
          'relative z-10 flex items-center gap-2 flex-1 min-w-0 transition-colors duration-200',
          isRowActive
            ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
            : 'group-hover:text-white group-hover:[text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
        )}
        >
          <GroupViewIcon view={presentedView} />
          <span className='truncate flex-1'>{displayNameForView(presentedView, t, { spaceGroup })}</span>
          {hasUnread && <UnreadDot />}
        </span>
      </MenuLink>
    </li>
  )
}

/** The new GroupViews-based navigation list. */
function GroupViewList ({
  groupViews,
  group,
  groupSlug,
  spaceSlug,
  spaceGroup = null,
  spaceMenuView = null,
  isEditing,
  onOpenSettings,
  canManageSpaces,
  canManageRound = false,
  hideAddSpace = false
}) {
  const { t } = useTranslation()
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)

  const handleOpenSpaceSettings = useCallback(() => {
    if (!spaceGroup || !onOpenSettings) return
    onOpenSettings(spaceMenuView || {
      type: 'space',
      name: spaceGroup.name,
      icon: spaceGroup.icon,
      linkedGroup: spaceGroup
    })
  }, [spaceGroup, spaceMenuView, onOpenSettings])

  if (isEditing) {
    return (
      <div className='relative flex flex-col z-20'>
        <GroupViewEditList
          views={groupViews}
          group={group}
          groupSlug={groupSlug}
          onSettings={onOpenSettings}
        />
        <div className='px-3 pb-3 flex flex-col gap-1'>
          {spaceGroup && (
            <button
              type='button'
              onClick={handleOpenSpaceSettings}
              className='flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100'
            >
              <Settings className='w-4 h-4' />
              <span>{t('Space Settings')}</span>
            </button>
          )}
          <AddViewButton onClick={() => setShowAddView(true)} />
          {canManageSpaces && !hideAddSpace && <AddSpaceButton onClick={() => setShowAddSpace(true)} />}
        </div>
        {showAddView && <AddGroupViewDialog group={group} groupViews={groupViews} acceptedPostTypes={group?.acceptedPostTypes} onClose={() => setShowAddView(false)} />}
        {showAddSpace && !hideAddSpace && <AddSpaceDialog group={group} onClose={() => setShowAddSpace(false)} />}
      </div>
    )
  }

  // Live menu: only views with an order (hidden views have order = null),
  // and post-type views must be allowed by the group's acceptedPostTypes.
  const visibleViews = groupViews
    .filter(view => view.order != null)
    .filter(view => viewAcceptedByPostTypes(view.type, group?.acceptedPostTypes))

  // Synthetic steward item for funding-round spaces — always last, not in the DB.
  const menuViews = (spaceGroup?.fundingRound?.id && canManageRound)
    ? [...visibleViews, MANAGE_ROUND_VIEW]
    : visibleViews

  return (
    <div className='relative flex flex-col z-20'>
      <ul className='m-0 p-3 mb-6'>
        {menuViews.map((view, index) => (
          <GroupViewMenuItem
            key={view.id || index}
            view={view}
            parentSlug={groupSlug}
            spaceGroup={spaceGroup}
            spaceSlug={spaceSlug}
          />
        ))}
      </ul>
    </div>
  )
}

/** Primary ContextMenu for Phase 2+. Fetches GroupViews and renders the new menu.
 *  A dev toggle at the bottom allows switching to ContextMenuOld (ContextWidgets) for comparison. */
export default function ContextMenu (props) {
  const {
    className,
    currentGroup,
    mapView
  } = props

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const location = useLocation()
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const { t } = useTranslation()

  const groupSlug = routeParams.groupSlug
  const routeSpaceSlug = routeParams.spaceSlug
  const group = useSelector(state => currentGroup || getGroupForSlug(state, groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_SPACES, groupId: group?.id }))
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister
  const [settingsView, setSettingsView] = useState(null)
  const isMoreViewsPath = location.pathname.replace(/\/$/, '').endsWith('/more-views')
  // On More Views page, `?space=` selects a space in the sidebar without leaving the page.
  const spaceSlug = routeSpaceSlug || (isMoreViewsPath ? getQuerystringParam('space', location) : null)

  const isPublicContext = routeParams.context === PUBLIC_CONTEXT_SLUG
  const isMyContext = routeParams.context === MY_CONTEXT_SLUG
  const isAllContext = routeParams.context === ALL_GROUPS_CONTEXT_SLUG
  const isGroupContext = routeParams.context === 'groups'
  const isOneColumnLayout = isGroupContext && resolveIsOneColumnLayout(
    currentUser?.settings?.groupNavStyle,
    group?.settings?.layout
  )
  const profileUrl = personUrl(currentUser?.id, groupSlug)

  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [dispatch])

  // Dev toggle: false = old ContextWidgets menu, true = new GroupViews menu
  const [useGroupViews, setUseGroupViews] = useState(true)

  const staticMenuViews = useMemo(() => {
    return getStaticMenuViews({
      isPublicContext,
      isMyContext: isMyContext || isAllContext,
      profileUrl
    })
  }, [isPublicContext, isMyContext, isAllContext, profileUrl])

  const fetchedGroupViews = useSelector(state => getGroupViews(state, group))
  const publishedOfferings = usePublishedOfferings(group?.id)
  const menuViews = useMemo(() => {
    const views = staticMenuViews || fetchedGroupViews
    if (staticMenuViews) return views
    // Managers always see paywalled spaces; others only when a published offering grants access
    return filterSpaceViewsForMenuVisibility(views, {
      offerings: publishedOfferings,
      canManageSpaces: canManageSpaces || isEditing
    })
  }, [staticMenuViews, fetchedGroupViews, publishedOfferings, canManageSpaces, isEditing])

  const { spaceView: activeSpaceView, spaceGroup: activeSpaceGroup } = useMemo(
    () => findSpaceForSlug(fetchedGroupViews, group, groupSlug, spaceSlug),
    [fetchedGroupViews, group, groupSlug, spaceSlug]
  )
  const isSpaceMember = Boolean(
    activeSpaceGroup &&
    myMemberships.some(m => m.group.id === activeSpaceGroup.id)
  )
  // Ordered (in-menu) spaces nest under the row; off-menu spaces drill into a replaced menu.
  const isOrderedMenuSpace = useMemo(() => {
    if (!spaceSlug || !groupSlug) return false
    return (fetchedGroupViews || []).some(view => (
      view.type === 'space' &&
      view.order != null &&
      view.linkedGroup &&
      localSpaceSlug(groupSlug, view.linkedGroup.slug) === spaceSlug
    ))
  }, [fetchedGroupViews, groupSlug, spaceSlug])
  const showingSpaceMenu = Boolean(
    isGroupContext &&
    activeSpaceGroup &&
    (isSpaceMember || (isMoreViewsPath && canAdminister)) &&
    (!isOrderedMenuSpace || (isMoreViewsPath && spaceSlug))
  )
  const spaceMenuViewsFromStore = useSelector(state =>
    showingSpaceMenu ? getGroupViews(state, activeSpaceGroup) : []
  )
  const spaceMenuViews = useMemo(() => {
    if (!showingSpaceMenu) return []
    if (spaceMenuViewsFromStore.length > 0) return spaceMenuViewsFromStore
    return activeSpaceGroup?.groupViews?.items || []
  }, [showingSpaceMenu, spaceMenuViewsFromStore, activeSpaceGroup])
  const spaceDisplayName = activeSpaceGroup?.name ||
    (activeSpaceView ? displayNameForView(GroupViewPresenter(activeSpaceView), t) : t('Space'))

  // Fetch GroupViews and spaces whenever we enter a real group context
  useEffect(() => {
    if (group?.id && isGroupContext) {
      dispatch(fetchGroupViews(group.id))
      dispatch(fetchGroupSpaces(group.id))
    }
  }, [group?.id, isGroupContext, dispatch])

  // Load the space's own views when the drill-in space menu is active.
  useEffect(() => {
    if (showingSpaceMenu && activeSpaceGroup?.id) {
      dispatch(fetchGroupViews(activeSpaceGroup.id))
    }
  }, [showingSpaceMenu, activeSpaceGroup?.id, dispatch])

  const handleBackToGroupMenu = useCallback(() => {
    if (isMoreViewsPath) {
      navigate(addQuerystringToPath(groupUrl(groupSlug, 'more-views'), { edit: 'true' }))
      return
    }
    const home = groupUrl(groupSlug)
    navigate(isEditing ? addQuerystringToPath(home, { edit: 'true' }) : home)
  }, [navigate, groupSlug, isEditing, isMoreViewsPath])

  // Allow scroll events to pass through to ContextMenu even when a modal post dialog is open
  useEffect(() => {
    const menu = document.querySelector('.ContextMenu')
    if (menu) {
      menu.addEventListener('wheel', (e) => { e.stopPropagation() }, { passive: false })
    }
  }, [])

  const handleScroll = useCallback(() => {
    window.dispatchEvent(new CustomEvent('contextMenuScroll'))
  }, [])

  useEffect(() => {
    if (isEditing) {
      const element = document.querySelector('.ContextMenu')
      if (element) element.scrollTop = element.scrollHeight
    }
  }, [isEditing])

  // Settings menu needs a viewport-bounded height so it can scroll independently of the
  // underlying view list (which stays mounted behind the settings overlay).
  const isSettingsPath = location.pathname.includes('/settings')

  const devToggle = (
    <div className='px-3 py-2 border-t border-foreground/10'>
      <button
        className='w-full flex items-center justify-center gap-2 text-xs text-foreground/50 hover:text-foreground border border-foreground/20 hover:border-foreground/50 rounded-md px-2 py-1 transition-all'
        onClick={() => setUseGroupViews(v => !v)}
        title='Dev: switch between new GroupViews and legacy ContextWidgets menu'
      >
        <RefreshCw className='w-3 h-3' />
        {useGroupViews ? t('Switch to Legacy Menu') : t('Switch to New Menu')}
      </button>
    </div>
  )

  const moreSpacesSection = isGroupContext && group?.id && !showingSpaceMenu
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        {isEditing
          ? (
            <div
              className='flex items-center gap-2 text-base text-foreground/40 border-2 border-transparent rounded-md p-1 pl-2 w-full cursor-not-allowed opacity-60'
              aria-disabled='true'
            >
              <CircleEllipsis className='w-4 h-4 shrink-0' />
              <span>{t('More Views and Spaces')}</span>
            </div>
            )
          : (
            <MenuLink
              to={groupUrl(groupSlug, 'more-views')}
              className='flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100'
            >
              <CircleEllipsis className='w-4 h-4 shrink-0' />
              <span>{t('More Views and Spaces')}</span>
            </MenuLink>
            )}
      </div>
      )
    : null

  const editMenuButton = canAdminister && isGroupContext && group?.id
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        <MenuLink
          to={
            isEditing
              ? groupUrl(groupSlug)
              : addQuerystringToPath(groupUrl(groupSlug, 'more-views'), {
                edit: 'true',
                ...(showingSpaceMenu && spaceSlug ? { space: spaceSlug } : {})
              })
          }
          isEditing={isEditing}
          className='flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100'
        >
          <Pencil className='w-4 h-4' />
          <span>{isEditing ? t('Done Editing') : t('Edit Menu')}</span>
        </MenuLink>
      </div>
      )
    : null

  const menuFooter = (
    <div className='mt-auto'>
      {moreSpacesSection}
      {editMenuButton}
      {devToggle}
    </div>
  )

  // Simple groups don't use the vertical widget context menu — their home dashboard
  // (ContextMenuGrid) replaces it. Only render the settings menu when on /settings.
  if (isOneColumnLayout && !location.pathname.includes('/settings')) {
    return null
  }

  // One-column layout on settings: only show the settings menu, not the full context menu.
  // Wrap in a sized container so the (position:fixed) menu reserves flex space and the
  // center column shifts over instead of rendering underneath it.
  if (isOneColumnLayout && location.pathname.includes('/settings')) {
    return (
      <div className='relative z-20 h-full flex-shrink-0 w-[260px] sm:w-[300px]'>
        <GroupSettingsMenu group={group} groupSlug={groupSlug} isOneColumn />
      </div>
    )
  }

  if (!useGroupViews) {
    return <ContextMenuOld {...props} devToggle={devToggle} />
  }

  return (
    <div
      className={cn(
        'ContextMenu bg-background relative z-20 isolate pointer-events-auto h-full flex-1 min-w-0',
        !isPhoneDevice() && 'sm:flex-initial sm:w-[300px]',
        { [classes.mapView]: mapView },
        {
          [classes.showGroupMenu]: isNavOpen,
          'h-screen h-dvh': isPhoneDevice(),
          'overflow-y-hidden flex flex-col': isSettingsPath,
          '!overflow-y-auto': !isSettingsPath
        },
        className
      )}
      style={{ boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.3)' }}
      onScroll={handleScroll}
    >
      <div className={cn(
        'relative flex flex-col',
        isSettingsPath ? 'flex-1 min-h-0 overflow-hidden' : 'min-h-full min-h-screen min-h-dvh'
      )}
      >
        <div className='absolute inset-0 bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 z-0 pointer-events-none' />
        <div className='ContextDetails w-full z-20 relative shrink-0'>
          {isGroupContext
            ? <GroupMenuHeader group={group} />
            : isPublicContext
              ? (
                <div className='TheCommonsHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md'>
                  <div className='absolute inset-0 z-10 bg-cover' style={{ ...bgImageStyle('/the-commons.jpg'), opacity: 0.8 }} />
                  <div className='absolute top-0 left-0 w-full h-full bg-darkening z-0' />
                  <div className='flex flex-col text-foreground drop-shadow-md overflow-hidden relative z-20'>
                    <h2 className='text-white font-bold leading-3 text-lg drop-shadow-md'>{t('The Commons')}</h2>
                  </div>
                </div>
                )
              : isMyContext
                ? (
                  <div className='MyHomeHeader relative flex flex-col justify-end p-2 bg-cover h-[190px] shadow-md'>
                    <div className='absolute inset-0 z-10 bg-cover bg-center' style={{ ...bgImageStyle(currentUser?.bannerUrl || '/default-user-banner.svg'), opacity: 0.8 }} />
                    <div className='absolute top-0 left-0 w-full h-full bg-darkening z-0 opacity-100' />
                    <div className='flex flex-col text-foreground drop-shadow-md overflow-hidden relative z-20'>
                      <h2 className='text-white font-bold leading-3 text-lg drop-shadow-md'>{t('My Home')}</h2>
                      {currentUser?.name && (
                        <p className='text-white/90 text-sm drop-shadow-md mt-1 truncate'>
                          {currentUser.name}{currentUser.email ? ` (${currentUser.email})` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  )
                : null}
        </div>

        <div className={cn('relative z-20 flex flex-col flex-1', isSettingsPath && 'min-h-0 overflow-hidden')}>
          <Routes>
            <Route path='settings/*' element={<GroupSettingsMenu group={group} groupSlug={groupSlug} />} />
          </Routes>

          {showingSpaceMenu
            ? (
              <>
                <div className='relative z-20 flex flex-col gap-1 px-3 py-2 border-b border-foreground/10'>
                  <button
                    type='button'
                    onClick={handleBackToGroupMenu}
                    className='flex items-center gap-1 self-start text-sm text-foreground/60 hover:text-foreground transition-colors'
                    aria-label={t('Back')}
                  >
                    <ChevronLeft className='w-5 h-5' />
                    <span>{t('Back')}</span>
                  </button>
                  <span className='font-semibold text-foreground truncate'>{spaceDisplayName}</span>
                </div>
                {spaceMenuViews.length > 0 || isEditing
                  ? (
                    <GroupViewList
                      groupViews={spaceMenuViews}
                      group={activeSpaceGroup}
                      groupSlug={groupSlug}
                      spaceSlug={spaceSlug}
                      spaceGroup={activeSpaceGroup}
                      spaceMenuView={activeSpaceView}
                      isEditing={isEditing}
                      onOpenSettings={setSettingsView}
                      canManageSpaces={false}
                      canManageRound={canManageSpaces}
                      hideAddSpace
                    />
                    )
                  : (
                    <div className='p-3 text-foreground/40 text-sm'>
                      {t('Loading views…')}
                    </div>
                    )}
              </>
              )
            : menuViews.length > 0
              ? (
                <GroupViewList
                  groupViews={menuViews}
                  group={group}
                  groupSlug={groupSlug}
                  spaceSlug={spaceSlug}
                  isEditing={isEditing}
                  onOpenSettings={setSettingsView}
                  canManageSpaces={canManageSpaces}
                />
                )
              : (
                <div className='p-3 text-foreground/40 text-sm'>
                  {group?.id ? t('Loading views…') : null}
                </div>
                )}
          {menuFooter}
          {settingsView && (
            settingsView.type === 'space'
              ? (
                <SpaceSettingsModal
                  view={settingsView}
                  space={settingsView.linkedGroup}
                  group={group}
                  onClose={() => setSettingsView(null)}
                />
                )
              : settingsView.type === 'collection'
                ? (
                  <AddCollectionDialog
                    group={showingSpaceMenu ? activeSpaceGroup : group}
                    view={settingsView}
                    onCancel={() => setSettingsView(null)}
                    onCreated={() => setSettingsView(null)}
                  />
                  )
                : (
                  <GroupViewSettingsModal
                    view={settingsView}
                    group={showingSpaceMenu ? activeSpaceGroup : group}
                    onClose={() => setSettingsView(null)}
                  />
                  )
          )}
        </div>

        {isNavOpen && (
          <div
            className={cn('ContextMenuCloseBg opacity-50 fixed right-0 top-0 w-full h-full z-10 transition-all duration-250 ease-in-out', { 'sm:block': isNavOpen })}
            onClick={toggleNavMenuAction}
          />
        )}
      </div>
    </div>
  )
}
