import { isPhoneDevice } from 'util/mobile'
import { get } from 'lodash/fp'
import { ChevronLeft, Info, Pencil, RefreshCw, Settings } from 'lucide-react'
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
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews
} from '@hylo/presenters/GroupViewPresenter'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import logout from 'store/actions/logout'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { bgImageStyle, cn } from 'util/index'
import { isOneColumnLayout as resolveIsOneColumnLayout } from 'util/navigationLayout'

import GroupSettingsMenu from './GroupSettingsMenu'
import ContextMenuOld from './ContextMenuOld'
import GroupViewEditList from './GroupViewEditList'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import MoreSpacesSection from './MoreSpacesSection'
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

/** Renders a single GroupView menu item, including nested space sub-items. */
function GroupViewMenuItem ({
  view,
  parentSlug,
  spaceGroup = null,
  spaceSlug = null,
  independentSpaceMenu = false
}) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])
  const myMemberships = useSelector(getMyMemberships)

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
    const spaceViews = (linkedSpaceGroup?.groupViews?.items || [])
      .filter(v => v.order != null)
      .filter(v => viewAcceptedByPostTypes(v.type, linkedSpaceGroup?.acceptedPostTypes))
      .map(v => GroupViewPresenter(v))
    const hasMultipleSpaceViews = spaceViews.length > 1
    const singleSpaceView = spaceViews.length === 1 ? spaceViews[0] : null
    const spaceUnread = spaceViews.some(v => v.newPostCount > 0)
    const spaceHome = linkedSpaceGroup ? spaceHomeUrl(parentSlug, linkedSpaceGroup) : null
    const spaceLink = singleSpaceView && isSpaceMember
      ? menuViewUrl(parentSlug, singleSpaceView, linkedSpaceGroup)
      : spaceHome
    const isSpaceActive = Boolean(
      spaceSlug &&
      linkedSpaceGroup &&
      localSpaceSlug(parentSlug, linkedSpaceGroup.slug) === spaceSlug
    )
    // Nested expand only when independent space menu is off and the space route is active.
    const isExpanded = !independentSpaceMenu && isSpaceMember && isSpaceActive && hasMultipleSpaceViews
    const aboutUrl = linkedSpaceGroup
      ? spaceUrl(parentSlug, localSpaceSlug(parentSlug, linkedSpaceGroup.slug), '/about')
      : null

    return (
      <li className='list-none'>
        <div
          className={cn(
            GROUP_VIEW_MENU_ITEM_CLASS,
            isSpaceActive && 'opacity-100 border-selected bg-card font-bold'
          )}
        >
          <MenuLink
            to={spaceLink}
            isActive={false}
            className={GROUP_VIEW_MENU_ITEM_INNER_LINK_CLASS}
          >
            <GroupViewIcon view={presentedView} />
            <span className='truncate flex-1'>{displayNameForView(presentedView, t, { spaceGroup })}</span>
            {spaceUnread && <UnreadDot />}
          </MenuLink>
          {aboutUrl && (
            <MenuLink
              to={aboutUrl}
              isActive={false}
              className='shrink-0 p-1 pr-1 text-foreground/50 hover:text-foreground border-0 bg-transparent mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100'
            >
              <Info className='w-4 h-4' aria-hidden='true' />
              <span className='sr-only'>{t('About')}</span>
            </MenuLink>
          )}
        </div>
        {isExpanded && (
          <ul className='pl-4 mt-1'>
            {spaceViews.map(subView => (
              <GroupViewMenuItem
                key={subView.id}
                view={subView}
                parentSlug={parentSlug}
                spaceGroup={linkedSpaceGroup}
                spaceSlug={spaceSlug}
                independentSpaceMenu={independentSpaceMenu}
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

  return (
    <li className='list-none'>
      <MenuLink
        to={isExternal ? null : url}
        externalLink={isExternal ? url : null}
        className={GROUP_VIEW_MENU_ITEM_CLASS}
      >
        <GroupViewIcon view={presentedView} />
        <span className='truncate flex-1'>{displayNameForView(presentedView, t, { spaceGroup })}</span>
        {hasUnread && <UnreadDot />}
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
  independentSpaceMenu = false,
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
          independentSpaceMenu={independentSpaceMenu}
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

  return (
    <div className='relative flex flex-col z-20'>
      <ul className='m-0 p-3 mb-6'>
        {visibleViews.map((view, index) => (
          <GroupViewMenuItem
            key={view.id || index}
            view={view}
            parentSlug={groupSlug}
            spaceGroup={spaceGroup}
            spaceSlug={spaceSlug}
            independentSpaceMenu={independentSpaceMenu}
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
  const spaceSlug = routeParams.spaceSlug
  const group = useSelector(state => currentGroup || getGroupForSlug(state, groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_SPACES, groupId: group?.id }))
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister
  const [settingsView, setSettingsView] = useState(null)
  const independentSpaceMenu = currentUser?.settings?.independentSpaceMenu === true

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
  const menuViews = staticMenuViews || fetchedGroupViews

  const { spaceView: activeSpaceView, spaceGroup: activeSpaceGroup } = useMemo(
    () => findSpaceForSlug(fetchedGroupViews, group, groupSlug, spaceSlug),
    [fetchedGroupViews, group, groupSlug, spaceSlug]
  )
  const isSpaceMember = Boolean(
    activeSpaceGroup &&
    myMemberships.some(m => m.group.id === activeSpaceGroup.id)
  )
  const showingSpaceMenu = Boolean(
    independentSpaceMenu &&
    isGroupContext &&
    activeSpaceGroup &&
    isSpaceMember
  )
  const spaceMenuViewsFromStore = useSelector(state =>
    showingSpaceMenu ? getGroupViews(state, activeSpaceGroup) : []
  )
  const spaceMenuViews = useMemo(() => {
    if (!showingSpaceMenu) return []
    if (spaceMenuViewsFromStore.length > 0) return spaceMenuViewsFromStore
    return activeSpaceGroup?.groupViews?.items || []
  }, [showingSpaceMenu, spaceMenuViewsFromStore, activeSpaceGroup])
  const spaceDisplayName = activeSpaceView
    ? displayNameForView(GroupViewPresenter(activeSpaceView), t)
    : (activeSpaceGroup?.name || t('Space'))

  // Fetch GroupViews whenever we enter a real group context
  useEffect(() => {
    if (group?.id && isGroupContext) {
      dispatch(fetchGroupViews(group.id))
    }
  }, [group?.id, isGroupContext])

  // Load the space's own views when the independent space menu is active.
  useEffect(() => {
    if (showingSpaceMenu && activeSpaceGroup?.id) {
      dispatch(fetchGroupViews(activeSpaceGroup.id))
    }
  }, [showingSpaceMenu, activeSpaceGroup?.id, dispatch])

  const handleBackToGroupMenu = useCallback(() => {
    const home = groupUrl(groupSlug)
    navigate(isEditing ? addQuerystringToPath(home, { edit: 'true' }) : home)
  }, [navigate, groupSlug, isEditing])

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
      <MoreSpacesSection
        group={group}
        groupSlug={groupSlug}
        spaceSlug={spaceSlug}
        isEditing={isEditing}
        independentSpaceMenu={independentSpaceMenu}
      />
      )
    : null

  const editMenuButton = canAdminister && isGroupContext && group?.id
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        <MenuLink
          to={addQuerystringToPath(location.pathname, { edit: isEditing ? null : 'true' })}
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
        { [classes.showGroupMenu]: isNavOpen, 'h-screen h-dvh': isPhoneDevice(), '!overflow-y-auto': !location.pathname.includes('/settings'), 'overflow-y-hidden': location.pathname.includes('/settings') },
        className
      )}
      style={{ boxShadow: 'inset -15px 0 15px -10px hsl(var(--darkening) / 0.3)' }}
      onScroll={handleScroll}
    >
      <div className='relative min-h-full min-h-screen min-h-dvh flex flex-col'>
        <div className='absolute inset-0 bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 z-0 pointer-events-none' />
        <div className='ContextDetails w-full z-20 relative'>
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

        <div className='relative z-20 flex flex-col flex-1'>
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
                      independentSpaceMenu={independentSpaceMenu}
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
                  independentSpaceMenu={independentSpaceMenu}
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
