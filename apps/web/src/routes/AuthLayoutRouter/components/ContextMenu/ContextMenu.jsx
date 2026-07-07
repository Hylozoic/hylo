import { isPhoneDevice } from 'util/mobile'
import { get } from 'lodash/fp'
import { ChevronRight, Pencil, RefreshCw } from 'lucide-react'
import React, { useEffect, useCallback, useState, useMemo } from 'react'
import { useLocation, Routes, Route } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'

import {
  ALL_GROUPS_CONTEXT_SLUG,
  MY_CONTEXT_SLUG,
  PUBLIC_CONTEXT_SLUG,
  groupUrl,
  postUrl,
  personUrl,
  localSpaceSlug,
  spaceHomeUrl,
  spaceGroupViewUrl,
  addQuerystringToPath,
  viewUrl
} from '@hylo/navigation'

import GroupMenuHeader from 'components/GroupMenuHeader'
import MenuLink from './MenuLink'
import GroupViewIcon from './GroupViewIcon'
import useRouteParams from 'hooks/useRouteParams'
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews,
  orderContextViewsForMenu
} from '@hylo/presenters/GroupViewPresenter'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import logout from 'store/actions/logout'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getMe from 'store/selectors/getMe'
import { bgImageStyle, cn } from 'util/index'

import GroupSettingsMenu from './GroupSettingsMenu'
import ContextMenuOld from './ContextMenuOld'
import GroupViewEditList from './GroupViewEditList'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION, RESP_MANAGE_SPACES } from 'store/constants'
import { WebViewMessageTypes } from '@hylo/shared'
import { getMobileAppVersion, sendMessageToWebView } from 'util/webView'

import classes from './ContextMenu.module.scss'

/** Resolves a URL for static My/Public/All context menu views. */
function contextViewUrl (view) {
  if (view.link) return view.link
  if (view.context && view.type) {
    return viewUrl(view.type, { context: view.context })
  }
  return null
}

/** Maps a GroupView to its URL within a group's route tree. Falls back to the group home. */
function groupViewUrl (groupSlug, view) {
  if (!view || !groupSlug) return groupUrl(groupSlug)

  switch (view.type) {
    case 'post':
      return view.viewPost?.id ? postUrl(view.viewPost.id, { groupSlug, context: 'groups' }) : groupUrl(groupSlug)
    case 'group':
      return view.linkedGroup?.slug ? groupUrl(view.linkedGroup.slug) : groupUrl(groupSlug)
    case 'member':
      return view.viewUser?.id ? personUrl(view.viewUser.id, groupSlug) : groupUrl(groupSlug)
    case 'all':
      return groupUrl(groupSlug, 'all')
    case 'chat':
      // Group-level chat — no topicName needed in the URL
      return groupUrl(groupSlug, 'chat')
    case 'events':
      return groupUrl(groupSlug, 'events')
    case 'map':
      return groupUrl(groupSlug, 'map')
    case 'members':
      return groupUrl(groupSlug, 'members')
    case 'about':
      return groupUrl(groupSlug, 'about')
    case 'welcome':
      return groupUrl(groupSlug, 'welcome')
    case 'discussions':
      return groupUrl(groupSlug, 'discussions')
    case 'proposals':
      return groupUrl(groupSlug, 'proposals')
    case 'projects':
      return groupUrl(groupSlug, 'projects')
    case 'resources':
      return groupUrl(groupSlug, 'resources')
    case 'requests-and-offers':
      return groupUrl(groupSlug, 'requests-and-offers')
    case 'related-groups':
      return groupUrl(groupSlug, 'groups')
    case 'decisions':
      return groupUrl(groupSlug, 'decisions')
    case 'custom':
      return groupUrl(groupSlug, `custom/${view.id}`)
    case 'collection':
      return groupUrl(groupSlug, `collection/${view.id}`)
    case 'track-actions':
      return groupUrl(groupSlug, 'track-actions')
    case 'funding-round-submissions':
      return groupUrl(groupSlug, 'funding-round-submissions')
    case 'space':
      return view.linkedGroup ? spaceHomeUrl(groupSlug, view.linkedGroup) : groupUrl(groupSlug)
    case 'link':
      return view.link || null
    default:
      return groupUrl(groupSlug, view.type || 'all')
  }
}

/** Small orange unread dot shown when a view has new posts. */
function UnreadDot () {
  return <span className='w-2 h-2 rounded-full bg-orange-500 shrink-0 ml-1' />
}

/** Resolves menu URL for a view — space sub-items use the parent/space URL pattern. */
function menuViewUrl (parentSlug, view, spaceGroup = null) {
  if (view?.link || view?.context) return contextViewUrl(view)
  if (spaceGroup) {
    const url = spaceGroupViewUrl(parentSlug, spaceGroup, view)
    if (url) return url
    return spaceHomeUrl(parentSlug, spaceGroup)
  }
  if (view?.type === 'space' && view.linkedGroup) {
    return spaceHomeUrl(parentSlug, view.linkedGroup)
  }
  return groupViewUrl(parentSlug, view)
}

/** Renders a single GroupView menu item, including nested space sub-items. */
function GroupViewMenuItem ({
  view,
  parentSlug,
  spaceGroup = null,
  spaceSlug = null,
  expandedSpaceId,
  setExpandedSpaceId,
  onCollapseSpaces
}) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])

  if (presentedView.type === 'separator') {
    return <hr className='border-foreground/10 my-1' />
  }

  if (presentedView.type === 'text') {
    const childViews = view.childViews || []
    return (
      <li className='list-none'>
        <p className='text-xs text-foreground/40 px-2 mt-3 mb-1 uppercase tracking-wide'>
          {displayNameForView(presentedView, t)}
        </p>
        {childViews.length > 0 && (
          <ul className='pl-4 mt-1 mb-2'>
            {childViews.map(subView => (
              <GroupViewMenuItem
                key={subView.id}
                view={subView}
                parentSlug={parentSlug}
                spaceGroup={spaceGroup}
                spaceSlug={spaceSlug}
                expandedSpaceId={expandedSpaceId}
                setExpandedSpaceId={setExpandedSpaceId}
                onCollapseSpaces={onCollapseSpaces}
              />
            ))}
          </ul>
        )}
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
            <span className='truncate'>{displayNameForView(presentedView, t)}</span>
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
    const spaceViews = (linkedSpaceGroup?.groupViews?.items || []).map(v => GroupViewPresenter(v))
    const spaceUnread = spaceViews.some(v => v.newPostCount > 0)
    const spaceHome = linkedSpaceGroup ? spaceHomeUrl(parentSlug, linkedSpaceGroup) : null
    const isExpanded = expandedSpaceId === presentedView.id
    const isSpaceActive = Boolean(
      spaceSlug &&
      linkedSpaceGroup &&
      localSpaceSlug(parentSlug, linkedSpaceGroup.slug) === spaceSlug
    )

    return (
      <li className='list-none'>
        <div
          className={cn(
            'flex items-center justify-between group rounded-md hover:bg-card transition-all',
            isSpaceActive && 'bg-card'
          )}
        >
          <MenuLink
            to={spaceHome}
            isActive={isSpaceActive}
            className='flex-1 flex items-center gap-2 text-base text-foreground p-1 pl-2 opacity-85 hover:opacity-100'
            onClick={() => setExpandedSpaceId(presentedView.id)}
          >
            <GroupViewIcon view={presentedView} />
            <span className='truncate'>{displayNameForView(presentedView, t)}</span>
            {spaceUnread && <UnreadDot />}
          </MenuLink>
          <button
            className='p-1 text-foreground/50 hover:text-foreground transition-all'
            onClick={() => setExpandedSpaceId(isExpanded ? null : presentedView.id)}
            aria-label={t('Toggle space views')}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
          </button>
        </div>
        {isExpanded && spaceViews.length > 0 && (
          <ul className='pl-4 mt-1'>
            {spaceViews.map(subView => (
              <GroupViewMenuItem
                key={subView.id}
                view={subView}
                parentSlug={parentSlug}
                spaceGroup={linkedSpaceGroup}
                spaceSlug={spaceSlug}
                expandedSpaceId={expandedSpaceId}
                setExpandedSpaceId={setExpandedSpaceId}
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
        className='flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 mb-[.3rem] w-full transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100'
        onClick={spaceGroup ? undefined : onCollapseSpaces}
      >
        <GroupViewIcon view={presentedView} />
        <span className='truncate flex-1'>{displayNameForView(presentedView, t)}</span>
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
  isEditing,
  onOpenSettings,
  canManageSpaces
}) {
  const [expandedSpaceId, setExpandedSpaceId] = useState(null)
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)

  // Auto-expand the space sub-menu when viewing a space route
  useEffect(() => {
    if (!spaceSlug || !groupViews?.length) return
    const spaceView = groupViews.find(v =>
      v.type === 'space' &&
      localSpaceSlug(groupSlug, v.linkedGroup?.slug) === spaceSlug
    )
    if (spaceView) setExpandedSpaceId(spaceView.id)
  }, [spaceSlug, groupViews, groupSlug])

  const handleCollapseSpaces = useCallback(() => setExpandedSpaceId(null), [])

  if (isEditing) {
    return (
      <div className='relative flex flex-col z-20'>
        <GroupViewEditList
          views={groupViews}
          group={group}
          groupSlug={groupSlug}
          onSettings={onOpenSettings}
        />
        <div className='px-3 pb-3'>
          <AddViewButton onClick={() => setShowAddView(true)} />
          {canManageSpaces && <AddSpaceButton onClick={() => setShowAddSpace(true)} />}
        </div>
        {showAddView && <AddGroupViewDialog group={group} groupViews={groupViews} onClose={() => setShowAddView(false)} />}
        {showAddSpace && <AddSpaceDialog group={group} onClose={() => setShowAddSpace(false)} />}
      </div>
    )
  }

  return (
    <div className='relative flex flex-col z-20'>
      <ul className='m-0 p-3 mb-6'>
        {groupViews.map((view, index) => (
          <GroupViewMenuItem
            key={view.id || index}
            view={view}
            parentSlug={groupSlug}
            spaceSlug={spaceSlug}
            expandedSpaceId={expandedSpaceId}
            setExpandedSpaceId={setExpandedSpaceId}
            onCollapseSpaces={handleCollapseSpaces}
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
  const routeParams = useRouteParams()
  const location = useLocation()
  const currentUser = useSelector(getMe)
  const { t } = useTranslation()

  const groupSlug = routeParams.groupSlug
  const spaceSlug = routeParams.spaceSlug
  const group = useSelector(state => currentGroup || getGroupForSlug(state, groupSlug))
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_MANAGE_SPACES, groupId: group?.id }))
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister
  const [settingsView, setSettingsView] = useState(null)

  const isPublicContext = routeParams.context === PUBLIC_CONTEXT_SLUG
  const isMyContext = routeParams.context === MY_CONTEXT_SLUG
  const isAllContext = routeParams.context === ALL_GROUPS_CONTEXT_SLUG
  const isGroupContext = routeParams.context === 'groups'
  const profileUrl = personUrl(currentUser?.id, groupSlug)

  const isNavOpen = useSelector(state => get('AuthLayoutRouter.isNavOpen', state))
  const toggleNavMenuAction = useCallback(() => dispatch(toggleNavMenu()), [dispatch])

  // Dev toggle: false = old ContextWidgets menu, true = new GroupViews menu
  const [useGroupViews, setUseGroupViews] = useState(true)

  const staticMenuViews = useMemo(() => {
    const views = getStaticMenuViews({
      isPublicContext,
      isMyContext: isMyContext || isAllContext,
      profileUrl
    })
    return views ? orderContextViewsForMenu(views) : null
  }, [isPublicContext, isMyContext, isAllContext, profileUrl])

  const fetchedGroupViews = useSelector(state => getGroupViews(state, group))
  const menuViews = staticMenuViews || fetchedGroupViews

  // Fetch GroupViews whenever we enter a real group context
  useEffect(() => {
    if (group?.id && isGroupContext) {
      dispatch(fetchGroupViews(group.id))
    }
  }, [group?.id, isGroupContext])

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
      {editMenuButton}
      {devToggle}
    </div>
  )

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

          {menuViews.length > 0
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
            <GroupViewSettingsModal
              view={settingsView}
              group={group}
              onClose={() => setSettingsView(null)}
            />
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
