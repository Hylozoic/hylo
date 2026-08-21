import { isDrawerNavLayout, isPhoneDevice } from 'util/mobile'
import { get } from 'lodash/fp'
import { CircleEllipsis, Info, Pencil, Settings, UserPlus, Users } from 'lucide-react'
import React, { useEffect, useCallback, useState, useMemo } from 'react'
import { Link, useLocation, useNavigate, Routes, Route } from 'react-router-dom'
import { replace } from 'redux-first-history'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'

import {
  ALL_GROUPS_CONTEXT_SLUG,
  MY_CONTEXT_SLUG,
  PUBLIC_CONTEXT_SLUG,
  groupUrl,
  localSpaceSlug,
  spaceUrl,
  addQuerystringToPath,
  personUrl
} from '@hylo/navigation'

import GroupMenuHeader from 'components/GroupMenuHeader'
import GroupNotificationsPopover from 'components/GroupNotificationsPopover/GroupNotificationsPopover'
import CurrentlyActiveMembers, { MENU_ACTIVE_MAX } from 'components/CurrentlyActiveMembers'
import InviteMembersDialog from 'components/InviteMembersDialog/InviteMembersDialog'
import MenuLink from './MenuLink'
import ContextMenuResizer from './ContextMenuResizer'
import GroupViewIcon from './GroupViewIcon'
import useRouteParams from 'hooks/useRouteParams'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import useGroupViews from 'hooks/useGroupViews'
import useMoreSpacesSections from 'hooks/useMoreSpacesSections'
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews,
  MANAGE_ROUND_VIEW
} from '@hylo/presenters/GroupViewPresenter'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import logout from 'store/actions/logout'
import { FETCH_GROUP_VIEWS, RESP_ADD_MEMBERS, RESP_ADMINISTRATION } from 'store/constants'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import isPendingFor from 'store/selectors/isPendingFor'
import { bgImageStyle, cn } from 'util/index'
import { isOneColumnLayout as resolveIsOneColumnLayout } from 'util/navigationLayout'
import { filterSpaceViewsForMenuVisibility, spaceMenuVisibilityOpts } from 'util/spaceVisibility'

import GroupSettingsMenu from './GroupSettingsMenu'
import MenuRowBackground from './MenuRowBackground'
import { viewCardColor } from './viewCardTheme'
import { DEFAULT_BANNER } from 'store/models/Group'
import GroupViewEditList from './GroupViewEditList'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddSpaceCollectionDialog from './AddSpaceCollectionDialog'
import AddGroupViewDialog from './AddGroupViewDialog'
import AddSpaceDialog from './AddSpaceDialog'
import AddViewOrSpaceMenu, { AddViewOrSpaceButton } from './AddViewOrSpaceMenu'
import TruncatedText from 'components/TruncatedText'
import { menuViewUrl, externalLinkHref, spaceEntryUrl, isParentGroupPath } from './groupViewMenuUrl'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { WebViewMessageTypes } from '@hylo/shared'
import { getMobileAppVersion, sendMessageToWebView } from 'util/webView'
import { viewShowsUnreadDot, viewUnreadBadgeCount } from 'util/viewUnreadBadges'

import classes from './ContextMenu.module.scss'

/** Small orange unread dot shown when a typed view has new posts. */
function UnreadDot () {
  return <span className='w-2 h-2 rounded-full bg-orange-500 shrink-0 ml-1' />
}

// Rows have no background of their own — the MenuRowBackground texture is the only
// surface (half strength on hover, full when selected). hover:text-foreground pins the
// link color so the global link-hover green never shows.
// Rows sit flush against each other and keep their margin on hover, so hovering
// never shifts the rows below it.
/* The banner fades into the plane colour set by the .plane class below it;
 * --menu-plane inherits, so the two can never drift apart. */
const MENU_PLANE_FADE_STYLE = { backgroundImage: 'linear-gradient(to bottom, transparent, var(--menu-plane))' }

const GROUP_VIEW_MENU_ITEM_CLASS = 'flex items-center gap-2 text-base font-medium text-foreground hover:text-foreground border-2 border-transparent rounded-md p-1 pl-2 my-0 w-full transition-all duration-200 ease-out scale-100 hover:scale-102 active:scale-[0.985] active:translate-y-[0.5px] active:duration-[50ms] opacity-85 hover:opacity-100'

/** MenuLink overrides when nested inside a styled space row wrapper. hover:text-foreground
 *  pins the anchor's color against the global link-hover green. */
const GROUP_VIEW_MENU_ITEM_INNER_LINK_CLASS = 'flex-1 flex items-center gap-2 min-w-0 border-0 bg-transparent p-0 mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100 hover:text-foreground font-inherit'

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

/** Visible menu views for a space (ordered), optionally with Manage Round. */
function visibleSpaceMenuViews (spaceGroup, { includeManageRound = false, views = null } = {}) {
  const spaceViews = (views || spaceGroup?.groupViews?.items || [])
    .filter(v => v.order != null)
  if (includeManageRound && spaceGroup?.fundingRound?.id) {
    return [...spaceViews, MANAGE_ROUND_VIEW]
  }
  return spaceViews
}

/** Space row with an optional More link for off-menu space views (single-view spaces). */
function SpaceMenuItemWithMore ({
  presentedView,
  resolvedSpaceGroup,
  isSpaceActive,
  isSpaceMember,
  spaceLink,
  keepNavOpen,
  aboutUrl,
  spaceUnread,
  spaceBannerUrl,
  spaceCol,
  parentSlug,
  localSpace,
  activeLabelClass,
  onPhotoLabelClass,
  onPhotoHoverLabelClass,
  spaceGroup
}) {
  const { t } = useTranslation()
  const spaceMoreSections = useMoreSpacesSections(resolvedSpaceGroup)
  const spaceMoreCount = (spaceMoreSections?.trackSpaces?.length || 0) +
    (spaceMoreSections?.fundingRoundSpaces?.length || 0) +
    (spaceMoreSections?.otherSpaces?.length || 0)
  const spaceMoreBadge = spaceMoreCount > 0
    ? (
      <span className='ml-auto shrink-0 text-xs leading-none text-foreground/50 bg-foreground/10 rounded-full px-1.5 py-1'>
        {spaceMoreCount}
      </span>
      )
    : null
  const spaceMoreLink = localSpace
    ? addQuerystringToPath(groupUrl(parentSlug, 'more-spaces'), { space: localSpace })
    : groupUrl(parentSlug, 'more-spaces')
  const spaceMemberCount = resolvedSpaceGroup?.memberCount ?? null

  return (
    <li className='list-none'>
      <div
        className={cn(
          GROUP_VIEW_MENU_ITEM_CLASS,
          'group relative overflow-hidden',
          isSpaceActive ? 'opacity-100 font-bold' : 'hover:border-[color:var(--row-border-hover)]'
        )}
        style={{
          // Hover border: view color at 20% (white steps over photos). Selected: full strength.
          '--row-border-hover': spaceBannerUrl ? 'hsl(0 0% 100% / 0.2)' : `${spaceCol}33`,
          ...(isSpaceActive ? { borderColor: spaceBannerUrl ? 'hsl(0 0% 100% / 0.35)' : spaceCol } : {})
        }}
      >
        <MenuRowBackground
          view={presentedView}
          bannerUrl={spaceBannerUrl}
          className={cn('transition-opacity duration-200', isSpaceActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')}
        />
        {/* Full-row hit area: the whole row opens the space; the title link and
            embedded controls ((i), pill) sit above it with their own handlers */}
        <MenuLink
          to={spaceLink}
          isActive={false}
          keepNavOpen={keepNavOpen}
          aria-hidden='true'
          tabIndex={-1}
          className='absolute inset-0 z-[5] border-0 bg-transparent p-0 mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100'
        />
        <MenuLink
          to={spaceLink}
          isActive={false}
          keepNavOpen={keepNavOpen}
          className={cn(
            GROUP_VIEW_MENU_ITEM_INNER_LINK_CLASS,
            // Shrink to the name so the (i) beside it hugs the title instead of
            // sitting at the row's far edge
            'flex-initial min-w-0 relative z-10',
            isSpaceActive
              ? (spaceBannerUrl ? onPhotoLabelClass : activeLabelClass)
              : (spaceBannerUrl ? onPhotoHoverLabelClass : null)
          )}
        >
          <GroupViewIcon view={presentedView} />
          <TruncatedText className='truncate min-w-0' text={displayNameForView(presentedView, t, { spaceGroup })} />
          {spaceUnread && <UnreadDot />}
        </MenuLink>
        {aboutUrl && isSpaceMember && (
          <MenuLink
            to={aboutUrl}
            isActive={false}
            className={cn(
              // Faint at rest — it sits right next to the title now
              'shrink-0 p-1 text-foreground/30 hover:text-foreground/70 border-0 bg-transparent mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100',
              'relative z-10',
              // Same reasoning as activeLabelClass — a variant, not the resolved scheme
              isSpaceActive
                ? (spaceBannerUrl
                    ? 'text-white/60 hover:text-white'
                    : 'text-foreground/50 hover:text-foreground dark:text-white/60 dark:hover:text-white')
                // Rides the same banner fade as the label beside it
                : (spaceBannerUrl ? 'group-hover:text-white/60 hover:text-white' : null)
            )}
          >
            <Info className='w-4 h-4' aria-hidden='true' />
            <span className='sr-only'>{t('About')}</span>
          </MenuLink>
        )}
        {(typeof spaceMemberCount === 'number' || !isSpaceMember) && (
          <span
            className={cn(
              // pointer-events-none: clicks land on the full-row link beneath,
              // so tapping + JOIN opens the space (and its join flow)
              'relative z-10 shrink-0 inline-flex items-center gap-0.5 text-xs leading-none rounded-full px-1.5 py-1 ml-auto mr-1 pointer-events-none',
              // Same banner/active color states as the (i) link beside it
              isSpaceActive
                ? (spaceBannerUrl
                    ? 'bg-white/15 text-white/90'
                    : 'bg-foreground/10 text-foreground/70 dark:bg-white/15 dark:text-white/90')
                : cn(
                  'bg-foreground/10 text-foreground/50',
                  spaceBannerUrl && 'group-hover:bg-white/15 group-hover:text-white/90'
                )
            )}
            aria-label={isSpaceMember ? t('{{count}} Members', { count: spaceMemberCount }) : t('Join')}
          >
            {isSpaceMember
              ? (
                <>
                  <Users className='w-3 h-3' aria-hidden='true' />
                  {spaceMemberCount}
                </>
                )
              : <span className='uppercase text-[10px] font-semibold tracking-wide'>+ {t('Join')}</span>}
          </span>
        )}
      </div>
      {isSpaceActive && spaceMoreCount > 0 && (
        <ul className='pl-4 mt-1'>
          <li className='list-none'>
            <MenuLink
              to={spaceMoreLink}
              className={cn(GROUP_VIEW_MENU_ITEM_CLASS)}
            >
              <CircleEllipsis className='w-4 h-4 shrink-0' />
              <span>{t('More Spaces')}</span>
              {spaceMoreBadge}
            </MenuLink>
          </li>
        </ul>
      )}
    </li>
  )
}

/** Renders a single GroupView menu item, including nested space sub-items. */
function GroupViewMenuItem ({
  view,
  parentSlug,
  group = null,
  spaceGroup = null,
  spaceSlug = null,
  parentGroup = null
}) {
  const dispatch = useDispatch()
  const location = useLocation()
  const { t } = useTranslation()
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])
  const myMemberships = useSelector(getMyMemberships)
  const canManageRound = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: view?.linkedGroup?.parentId
  }))
  // Prefer the space Group's ORM menu / acceptedPostTypes over the parent's nested
  // linkedGroup copy, which can lag behind hide/delete and space-settings updates.
  const linkedSpaceGroupId = presentedView.type === 'space' ? presentedView.linkedGroup?.id : null
  const linkedSpaceSlug = presentedView.type === 'space' ? presentedView.linkedGroup?.slug : null
  const spaceGroupFromStore = useSelector(state =>
    linkedSpaceSlug ? getGroupForSlug(state, linkedSpaceSlug) : null
  )
  const spaceViewsFromStore = useGroupViews(linkedSpaceGroupId ? { id: linkedSpaceGroupId } : null)
  // Labels over the revealed row background: white on dark surfaces (and photos),
  // regular foreground on the pale light-mode surface. Hover never changes text color.
  //
  // Expressed as a dark: variant rather than from effectiveColorScheme on purpose.
  // That hook resolves through the Redux currentUser, so until it loads the scheme
  // falls back to 'auto' — the OS. Anyone running Hylo dark with a light OS saw the
  // label paint near-black and then flip to white when their settings arrived. The
  // class on documentElement is set in the same breath as the CSS variables, so a
  // variant can never disagree with the palette it is sitting on.
  const activeLabelClass = 'text-foreground dark:text-white dark:hover:text-white dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
  const onPhotoLabelClass = 'text-white hover:text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
  // Hovering an unselected space fades its banner in behind the row, so the label
  // has to go white at the same moment or it is dark text on a photo. No transition
  // on the colour — it switches at once while the photo fades in under it.
  // Banner rows only: without one the light-mode surface is a pale wash that white
  // would disappear into.
  const onPhotoHoverLabelClass = 'group-hover:text-white hover:text-white group-hover:[text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'

  if (presentedView.type === 'separator') {
    return <hr className='border-t-2 border-foreground/10 mt-5 mb-2' />
  }

  if (presentedView.type === 'text') {
    return (
      <li className='list-none'>
        {/* mt-8 + first:mt-2 was a broken pair: the p is always the first child of its
            own li, so first: matched every label and mt-8 never applied at all */}
        <p className='text-xs text-foreground/40 px-2 mt-5 mb-1.5 uppercase tracking-wide'>
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
            <TruncatedText className='truncate' text={displayNameForView(presentedView, t, { spaceGroup })} />
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
    // Filter with ORM acceptedPostTypes when available (space settings update that record).
    const resolvedSpaceGroup = spaceGroupFromStore || linkedSpaceGroup
    const spaceViews = visibleSpaceMenuViews(
      resolvedSpaceGroup,
      { views: spaceViewsFromStore.length > 0 ? spaceViewsFromStore : null }
    ).map(v => GroupViewPresenter(v))
    const menuSpaceViews = showManageRound
      ? [...spaceViews, GroupViewPresenter(MANAGE_ROUND_VIEW)]
      : spaceViews
    const singleSpaceView = menuSpaceViews.length === 1 ? menuSpaceViews[0] : null
    // Space badge = membership unread or pending join requests (same orange dot).
    const spaceMembership = linkedSpaceGroup &&
      myMemberships.find(m => String(m.group.id) === String(linkedSpaceGroup.id))
    const spaceUnread = (spaceMembership?.newPostCount || 0) > 0
    const spaceJoinRequests = (
      spaceGroupFromStore?.openJoinRequestCount ||
      linkedSpaceGroup?.openJoinRequestCount ||
      0
    ) > 0
    const showSpaceDot = spaceUnread || spaceJoinRequests
    // Single-view spaces open that view directly. Multi-view spaces open the
    // space menu: the drawer stays open on mobile, and the URL is the space
    // index so dismissing the drawer still shows that menu rather than home.
    const drillIntoSpaceMenu = isSpaceMember && !singleSpaceView
    const keepNavOpen = drillIntoSpaceMenu && isDrawerNavLayout()
    const spaceLink = singleSpaceView && isSpaceMember
      ? menuViewUrl(parentSlug, singleSpaceView, resolvedSpaceGroup)
      : spaceEntryUrl(parentSlug, resolvedSpaceGroup)
    const isSpaceActive = Boolean(
      spaceSlug &&
      linkedSpaceGroup &&
      localSpaceSlug(parentSlug, linkedSpaceGroup.slug) === spaceSlug
    )
    const localSpace = linkedSpaceGroup
      ? localSpaceSlug(parentSlug, linkedSpaceGroup.slug)
      : null
    const aboutUrl = localSpace ? spaceUrl(parentSlug, localSpace, 'about') : null

    // Active space rows reveal the space's banner photo (uploaded ones only);
    // spaces without a banner fall back to the tinted icon texture.
    // Read the store record first with the parent's nested copy as fallback:
    // right after selecting a space, whichever source is mid-refetch can briefly
    // drop bannerUrl, and since the label color keys off it (white on photo,
    // foreground on texture) a one-source read flashed the light-mode label
    // dark until the banner came back.
    const spaceBannerCandidate = spaceGroupFromStore?.bannerUrl || linkedSpaceGroup?.bannerUrl
    const spaceBannerUrl = spaceBannerCandidate && spaceBannerCandidate !== DEFAULT_BANNER
      ? spaceBannerCandidate
      : null
    const spaceCol = viewCardColor(presentedView)

    return (
      <SpaceMenuItemWithMore
        presentedView={presentedView}
        resolvedSpaceGroup={resolvedSpaceGroup}
        isSpaceActive={isSpaceActive}
        isSpaceMember={isSpaceMember}
        spaceLink={spaceLink}
        keepNavOpen={keepNavOpen}
        aboutUrl={aboutUrl}
        spaceUnread={showSpaceDot}
        spaceBannerUrl={spaceBannerUrl}
        spaceCol={spaceCol}
        parentSlug={parentSlug}
        localSpace={localSpace}
        activeLabelClass={activeLabelClass}
        onPhotoLabelClass={onPhotoLabelClass}
        onPhotoHoverLabelClass={onPhotoHoverLabelClass}
        spaceGroup={spaceGroup}
      />
    )
  }

  const url = menuViewUrl(parentSlug, presentedView, spaceGroup)
  const chatBadgeCount = viewUnreadBadgeCount(presentedView)
  const showUnreadDot = viewShowsUnreadDot(presentedView)
  const externalHref = externalLinkHref(presentedView)
  const isExternal = Boolean(externalHref)
  // The selected row reveals a postType-tinted icon-texture background,
  // mirroring the one-column dashboard cards.
  const isRowActive = Boolean(!isExternal && url && (location.pathname === url || location.pathname.startsWith(`${url}/`)))
  const rowCol = viewCardColor(presentedView)
  const inviteGroup = spaceGroup || group

  if (presentedView.type === 'members' && inviteGroup) {
    return (
      <li className='list-none'>
        <div
          className={cn(
            GROUP_VIEW_MENU_ITEM_CLASS,
            'group relative overflow-hidden',
            isRowActive ? 'opacity-100 font-bold' : 'hover:border-[color:var(--row-border-hover)]'
          )}
          style={{
            '--row-border-hover': `${rowCol}33`,
            ...(isRowActive ? { borderColor: rowCol } : {})
          }}
        >
          <MenuRowBackground
            view={presentedView}
            className={cn('transition-opacity duration-200', isRowActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')}
          />
          <CurrentlyActiveMembers
            group={inviteGroup}
            parentGroup={spaceGroup ? parentGroup : null}
            max={MENU_ACTIVE_MAX}
            membersUrl={url}
            profileGroupSlug={parentSlug}
            className='relative z-10 flex-1 min-w-0 mr-1'
          />
        </div>
      </li>
    )
  }

  return (
    <li className='list-none'>
      <MenuLink
        to={isExternal ? null : url}
        externalLink={externalHref}
        isActive={false}
        badgeCount={chatBadgeCount}
        className={cn(
          GROUP_VIEW_MENU_ITEM_CLASS,
          'group relative overflow-hidden',
          isRowActive ? 'opacity-100 font-bold' : 'hover:border-[color:var(--row-border-hover)]'
        )}
        style={{
          // Hover border: view color at 20%. Selected: full strength.
          '--row-border-hover': `${rowCol}33`,
          ...(isRowActive ? { borderColor: rowCol } : {})
        }}
      >
        <MenuRowBackground
          view={presentedView}
          className={cn('transition-opacity duration-200', isRowActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50')}
        />
        <span className={cn(
          'relative z-10 flex items-center gap-2 flex-1 min-w-0',
          isRowActive && activeLabelClass
        )}
        >
          <GroupViewIcon view={presentedView} />
          <TruncatedText className='truncate flex-1' text={displayNameForView(presentedView, t, { spaceGroup })} />
          {showUnreadDot && <UnreadDot />}
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
  parentGroup = null,
  isEditing,
  onOpenSettings,
  canAdminister = false
}) {
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)
  // Spaces cannot nest spaces; Add Space is parent-menu only
  const canAddSpace = canAdminister && !spaceGroup

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
          {/* One Add control opening the same view/space chooser the card grids use,
              rather than a button per kind. p-1 matches the Done Editing button height below */}
          <AddViewOrSpaceMenu
            trigger={<AddViewOrSpaceButton className='p-1 pl-2' />}
            onChooseView={() => setShowAddView(true)}
            onChooseSpace={() => setShowAddSpace(true)}
            canAddSpace={canAddSpace}
          />
        </div>
        {showAddView && <AddGroupViewDialog group={group} groupViews={groupViews} acceptedPostTypes={group?.acceptedPostTypes} onClose={() => setShowAddView(false)} />}
        {showAddSpace && canAddSpace && <AddSpaceDialog group={group} onClose={() => setShowAddSpace(false)} />}
      </div>
    )
  }

  // Live menu: only views with an order (hidden views have order = null).
  const visibleViews = groupViews
    .filter(view => view.order != null)

  // Synthetic steward item for funding-round spaces — always last, not in the DB.
  const menuViews = (spaceGroup?.fundingRound?.id && canAdminister)
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
            group={group}
            spaceGroup={spaceGroup}
            spaceSlug={spaceSlug}
            parentGroup={parentGroup}
          />
        ))}
      </ul>
    </div>
  )
}

/** Primary ContextMenu. Fetches GroupViews and renders the group/space menu. */
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
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister
  const [settingsView, setSettingsView] = useState(null)
  // The width-drag strip measures its seam position from this element
  const [menuRootEl, setMenuRootEl] = useState(null)
  const isMoreSpacesPath = location.pathname.replace(/\/$/, '').endsWith('/more-spaces')
  // On More Spaces page, `?space=` selects a space in the sidebar without leaving the page.
  const spaceSlug = routeSpaceSlug || (isMoreSpacesPath ? getQuerystringParam('space', location) : null)

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

  const staticMenuViews = useMemo(() => {
    return getStaticMenuViews({
      isPublicContext,
      isMyContext: isMyContext || isAllContext,
      profileUrl
    })
  }, [isPublicContext, isMyContext, isAllContext, profileUrl])

  const fetchedGroupViews = useGroupViews(group)
  const viewsPending = useSelector(state => isPendingFor(FETCH_GROUP_VIEWS, state))
  const groupViewsLoading = viewsPending && fetchedGroupViews.length === 0
  // Count for the group-level More badge (off-menu tracks + rounds + other spaces)
  const moreSpacesSections = useMoreSpacesSections(isGroupContext ? group : null)
  const publishedOfferings = usePublishedOfferings(group?.id)
  const menuViews = useMemo(() => {
    const views = staticMenuViews || fetchedGroupViews
    if (staticMenuViews) return views
    return filterSpaceViewsForMenuVisibility(views, spaceMenuVisibilityOpts({
      offerings: publishedOfferings,
      canManageSpaces: canAdminister,
      memberships: myMemberships,
      currentUser,
      parentGroupId: group?.id
    }))
  }, [staticMenuViews, fetchedGroupViews, publishedOfferings, canAdminister, myMemberships, currentUser, group?.id])

  const { spaceView: activeSpaceView, spaceGroup: linkedActiveSpaceGroup } = useMemo(
    () => findSpaceForSlug(fetchedGroupViews, group, groupSlug, spaceSlug),
    [fetchedGroupViews, group, groupSlug, spaceSlug]
  )
  // Prefer the ORM space record so acceptedPostTypes updates from Space Settings
  // apply immediately (nested linkedGroup copies can lag until parent refetch).
  const spaceGroupFromStore = useSelector(state =>
    linkedActiveSpaceGroup?.slug ? getGroupForSlug(state, linkedActiveSpaceGroup.slug) : null
  )
  const activeSpaceGroup = spaceGroupFromStore || linkedActiveSpaceGroup
  const isSpaceMember = Boolean(
    activeSpaceGroup &&
    myMemberships.some(m => m.group.id === activeSpaceGroup.id)
  )
  // Ordered single-view spaces stay in the group menu; multi-view and off-menu spaces drill in.
  const spaceMenuViewsFromStore = useGroupViews(activeSpaceGroup)
  const activeSpaceHasMultipleViews = useMemo(() => {
    if (!activeSpaceGroup) return false
    return visibleSpaceMenuViews(activeSpaceGroup, {
      views: spaceMenuViewsFromStore.length > 0 ? spaceMenuViewsFromStore : null,
      includeManageRound: Boolean(activeSpaceGroup?.fundingRound?.id && canAdminister)
    }).length > 1
  }, [activeSpaceGroup, spaceMenuViewsFromStore, canAdminister])
  const showingSpaceMenu = Boolean(
    isGroupContext &&
    activeSpaceGroup &&
    (isSpaceMember || (isMoreSpacesPath && canAdminister)) &&
    (activeSpaceHasMultipleViews || (isMoreSpacesPath && spaceSlug))
  )
  const spaceMenuViews = useMemo(() => {
    if (!showingSpaceMenu) return []
    if (spaceMenuViewsFromStore.length > 0) return spaceMenuViewsFromStore
    return activeSpaceGroup?.groupViews?.items || []
  }, [showingSpaceMenu, spaceMenuViewsFromStore, activeSpaceGroup])
  // Off-menu count for the space menu's More row (spaces not shown in the space menu).
  const spaceMoreSpacesSections = useMoreSpacesSections(showingSpaceMenu ? activeSpaceGroup : null)
  const spaceViewsLoading = viewsPending && spaceMenuViews.length === 0
  const spaceDisplayName = activeSpaceGroup?.name ||
    (activeSpaceView ? displayNameForView(GroupViewPresenter(activeSpaceView), t) : t('Space'))
  const presentedActiveSpaceView = useMemo(
    () => activeSpaceView ? GroupViewPresenter(activeSpaceView) : null,
    [activeSpaceView]
  )
  const activeSpaceBannerUrl = activeSpaceGroup?.bannerUrl && activeSpaceGroup.bannerUrl !== DEFAULT_BANNER
    ? activeSpaceGroup.bannerUrl
    : null

  // Menu views on every group navigation. Off-menu spaces are loaded when More
  // Spaces or edit mode opens — they overlap heavily with this query.
  useEffect(() => {
    if (group?.id && isGroupContext) {
      dispatch(fetchGroupViews(group.id))
    }
  }, [group?.id, isGroupContext, dispatch])

  useEffect(() => {
    if (group?.id && isGroupContext && isEditing) {
      dispatch(fetchGroupSpaces(group.id))
    }
  }, [group?.id, isGroupContext, isEditing, dispatch])

  // Load the space's own views when inside a space (multi-view check + space menu).
  useEffect(() => {
    if (activeSpaceGroup?.id && spaceSlug) {
      dispatch(fetchGroupViews(activeSpaceGroup.id))
    }
  }, [activeSpaceGroup?.id, spaceSlug, dispatch])

  const previousLocation = useSelector(getPreviousLocation)
  // Return to the previous page only when it is a view of this parent group.
  // Other origins (another group, All, a notification deep link) go to home.
  const handleBackToGroupMenu = useCallback(() => {
    if (isParentGroupPath(previousLocation?.pathname, groupSlug)) {
      navigate(previousLocation)
      return
    }
    const home = groupUrl(groupSlug)
    navigate(isEditing ? addQuerystringToPath(home, { edit: 'true' }) : home)
  }, [navigate, groupSlug, isEditing, previousLocation])

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

  // Settings menu needs a viewport-bounded height so it can scroll independently of the
  // underlying view list (which stays mounted behind the settings overlay).
  // Match only the group's Group Settings URL — not a space About tab (`…/about/settings`).
  const isSettingsPath = Boolean(groupSlug && location.pathname.startsWith(`/groups/${groupSlug}/settings`))

  useEffect(() => {
    if (isEditing) {
      const element = document.querySelector('.ContextMenu')
      if (element) element.scrollTop = element.scrollHeight
    }
  }, [isEditing])

  // Footer More uses the space's off-menu items when drilled into a space menu.
  const footerMoreSections = showingSpaceMenu ? spaceMoreSpacesSections : moreSpacesSections
  const moreSpacesCount = (footerMoreSections?.trackSpaces?.length || 0) +
    (footerMoreSections?.fundingRoundSpaces?.length || 0) +
    (footerMoreSections?.otherSpaces?.length || 0)
  const moreSpacesBadge = moreSpacesCount > 0
    ? (
      <span className='ml-auto shrink-0 text-xs leading-none text-foreground/50 bg-foreground/10 rounded-full px-1.5 py-1'>
        {moreSpacesCount}
      </span>
      )
    : null
  const moreSpacesLink = addQuerystringToPath(groupUrl(groupSlug, 'more-spaces'), {
    ...(showingSpaceMenu && spaceSlug ? { space: spaceSlug } : {}),
    ...(isEditing ? { edit: 'true' } : {})
  })

  const joinRequestTargetGroup = showingSpaceMenu ? activeSpaceGroup : group
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: joinRequestTargetGroup?.id
  }))
  const joinRequestCount = joinRequestTargetGroup?.openJoinRequestCount || 0
  const joinRequestsLink = showingSpaceMenu && spaceSlug
    ? spaceUrl(groupSlug, spaceSlug, 'requests')
    : (group?.slug ? groupUrl(group.slug, 'requests') : null)
  const joinRequestsSection = isGroupContext && joinRequestsLink && canAddMembers && joinRequestCount > 0
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        {isEditing
          ? (
            <div
              className='flex items-center gap-2 text-base font-medium text-foreground/40 border-2 border-transparent rounded-md p-1 pl-2 w-full cursor-not-allowed opacity-60'
              aria-disabled='true'
            >
              <UserPlus className='w-4 h-4 shrink-0' />
              <span>{t('Join Requests')}</span>
            </div>
            )
          : (
            <MenuLink
              to={joinRequestsLink}
              badgeCount={joinRequestCount}
              className='flex items-center gap-2 text-base font-medium text-foreground hover:text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 pr-8 w-full transition-all opacity-85 hover:opacity-100'
            >
              <UserPlus className='w-4 h-4 shrink-0' />
              <span>{t('Join Requests')}</span>
            </MenuLink>
            )}
      </div>
      )
    : null

  // Hidden when there is nothing behind it, and while editing a space menu —
  // spaces cannot nest spaces. Stays clickable in the group Edit Menu so
  // mobile can open the page; desktop group Edit Menu is already there,
  // so the row reads as selected instead of disabled.
  const moreSpacesSection = isGroupContext && group?.id && moreSpacesCount > 0 && !(showingSpaceMenu && isEditing)
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        <MenuLink
          to={moreSpacesLink}
          isActive={isMoreSpacesPath}
          className='flex items-center gap-2 text-base font-medium text-foreground hover:text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100'
        >
          <CircleEllipsis className='w-4 h-4 shrink-0' />
          <span>{t('More Spaces')}</span>
          {moreSpacesBadge}
        </MenuLink>
      </div>
      )
    : null

  const editToggleUrl = (() => {
    const params = new URLSearchParams(location.search)
    if (isEditing) params.delete('edit')
    else params.set('edit', 'true')
    const search = params.toString()
    return `${location.pathname}${search ? `?${search}` : ''}`
  })()
  // Drawer and space menus stay on the current view. Desktop group Edit Menu
  // still opens More Spaces (where you add/remove off-menu spaces).
  const stayOnCurrentView = isDrawerNavLayout() || showingSpaceMenu
  const editMenuButton = canAdminister && isGroupContext && group?.id
    ? (
      <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
        <MenuLink
          to={
            stayOnCurrentView
              ? editToggleUrl
              : isEditing
                ? groupUrl(groupSlug)
                : addQuerystringToPath(groupUrl(groupSlug, 'more-spaces'), { edit: 'true' })
          }
          keepNavOpen={isDrawerNavLayout()}
          isEditing={isEditing}
          className='flex items-center gap-2 text-base font-medium text-foreground hover:text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100'
        >
          <Pencil className='w-4 h-4' />
          <span>{isEditing ? t('Done Editing') : t('Edit Menu')}</span>
        </MenuLink>
      </div>
      )
    : null

  const menuFooter = (
    <div className='mt-auto'>
      {joinRequestsSection}
      {moreSpacesSection}
      {editMenuButton}
    </div>
  )

  // Simple groups don't use the vertical widget context menu — their home dashboard
  // (ContextMenuGrid) replaces it. Only render the settings menu when on /settings.
  if (isOneColumnLayout && !isSettingsPath) {
    return null
  }

  // One-column layout on settings: only show the settings menu, not the full context menu.
  // Wrap in a sized container so the (position:fixed) menu reserves flex space and the
  // center column shifts over instead of rendering underneath it.
  if (isOneColumnLayout && isSettingsPath) {
    return (
      <div className='relative z-20 h-full flex-shrink-0 w-[260px] sm:w-[300px]'>
        <GroupSettingsMenu group={group} groupSlug={groupSlug} isOneColumn />
      </div>
    )
  }

  return (
    <div
      ref={setMenuRootEl}
      className={cn(
        'ContextMenu bg-background bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 relative z-20 isolate pointer-events-auto h-full flex-1 min-w-0',
        !isPhoneDevice() && 'sm:flex-initial sm:w-[var(--context-menu-width,300px)]',
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
      {/* Fixed-position, so the menu's own overflow scrolling never clips it */}
      {!isPhoneDevice() && <ContextMenuResizer menuEl={menuRootEl} />}
      <div className={cn(
        'relative flex flex-col',
        // Flat wrap color in the gutters around the inset menu card. The
        // banner (below) only lives at the top and fades into this.
        isGroupContext && classes.plane,
        isSettingsPath ? 'flex-1 min-h-0 overflow-hidden' : 'min-h-full min-h-screen min-h-dvh'
      )}
      >
        <div className='relative z-10 shrink-0'>
          {/* Banner fills the header and overflows slightly so it wraps the
              top of the menu card, then fades into the wrap background. */}
          {isGroupContext && group && (
            <div className='absolute inset-x-0 top-0 -bottom-8 z-0 pointer-events-none'>
              <div className='absolute inset-0 bg-darkening opacity-80' />
              <div
                className='absolute inset-0 bg-cover bg-center'
                style={{ ...bgImageStyle(group.bannerUrl || DEFAULT_BANNER), opacity: 0.5 }}
              />
              <div className='absolute inset-x-0 bottom-0 h-8' style={MENU_PLANE_FADE_STYLE} />
            </div>
          )}
          <div className='ContextDetails w-full relative z-10'>
            {isGroupContext
            /* Duck only when the space really takes the menu over (its own
               header below) — single-view in-menu spaces stay in the group list */
              ? (
                <GroupMenuHeader
                  group={group}
                  compact={showingSpaceMenu}
                  hideBanner
                  onCompactClick={handleBackToGroupMenu}
                />
                )
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
                : (isMyContext || isAllContext)
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
        </div>

        <div className={cn(
          'relative z-10 flex flex-col flex-1',
          // Inset card: banner wraps its top corners, background color wraps
          // the rest. No overflow-hidden so dropdowns/modals are not clipped.
          isGroupContext && 'mx-2 mb-2 rounded-2xl bg-background bg-gradient-to-b from-context-menu-background to-theme-background/10 dark:to-theme-background/40 shadow-md',
          isSettingsPath && 'min-h-0 overflow-hidden'
        )}
        >
          <Routes>
            <Route path='settings/*' element={<GroupSettingsMenu group={group} groupSlug={groupSlug} />} />
          </Routes>

          {showingSpaceMenu
            ? (
              <>
                {/* h-[142px]: with the ducked group header's h-12 this sums to the
                    full-size header's 190px, so the takeover swaps hierarchy without
                    moving the menu below */}
                {/* Closing the space lives in the ducked group header's back chevron above */}
                <div className='SpaceMenuHeader relative z-20 flex flex-col justify-between h-[142px] overflow-hidden rounded-t-2xl border-b border-foreground/10 shadow-md'>
                  {activeSpaceBannerUrl
                    ? (
                      <>
                        <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(activeSpaceBannerUrl)} />
                        <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
                      </>
                      )
                    : presentedActiveSpaceView && (
                      <MenuRowBackground view={presentedActiveSpaceView} bannerUrl={null} rows={8} spaced className='rounded-none' />
                    )}
                  {/* Where the X used to sit: this space's notification settings */}
                  <div
                    className={cn(
                      'relative z-10 self-start m-2 p-1 rounded-md backdrop-blur-sm transition-colors',
                      activeSpaceBannerUrl
                        ? 'bg-black/25 text-white/90 hover:bg-black/40 hover:text-white'
                        : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/20 hover:text-foreground dark:text-white/80 dark:hover:text-white'
                    )}
                  >
                    <GroupNotificationsPopover group={activeSpaceGroup} className='w-5 h-5' />
                  </div>
                  {canAdminister && activeSpaceView && (
                    <button
                      type='button'
                      onClick={() => setSettingsView(activeSpaceView)}
                      className='absolute top-2 right-2 z-10'
                      aria-label={t('Space Settings')}
                      title={t('Space Settings')}
                    >
                      <Settings className={cn(
                        'w-6 h-6 drop-shadow-md hover:scale-110 transition-all',
                        activeSpaceBannerUrl
                          ? 'text-white/90 hover:text-white'
                          : 'text-foreground/60 hover:text-foreground dark:text-white/80 dark:hover:text-white'
                      )}
                      />
                    </button>
                  )}
                  <div className='relative z-10 flex items-center gap-2 p-2 min-w-0'>
                    <div
                      style={presentedActiveSpaceView?.avatarUrl ? bgImageStyle(presentedActiveSpaceView.avatarUrl) : {}}
                      className={cn(
                        // Sized to the name + pills column beside it (fixed: a bg-image-only
                        // box has no intrinsic width for a stretched square to grow from)
                        'h-[52px] w-[52px] rounded-lg shadow-md bg-cover bg-center relative overflow-hidden shrink-0 flex items-center justify-center',
                        // Frosted glass, standardized with the space cards' tile
                        !presentedActiveSpaceView?.avatarUrl && cn(
                          'backdrop-blur-sm',
                          activeSpaceBannerUrl
                            ? 'bg-white/15 text-white'
                            : 'bg-black/5 text-foreground/80 dark:bg-white/15 dark:text-white'
                        )
                      )}
                    >
                      {!presentedActiveSpaceView?.avatarUrl && (
                        <GroupViewIcon view={presentedActiveSpaceView} className='w-6 h-6' />
                      )}
                    </div>
                    <div className='flex flex-col flex-1 min-w-0'>
                      <TruncatedText
                        className={cn(
                          'truncate font-bold text-xl/6',
                          activeSpaceBannerUrl
                            ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.65)]'
                            : 'text-foreground dark:text-white'
                        )}
                        text={spaceDisplayName}
                      />
                      <span className='flex items-center gap-1 mt-1.5 text-xs'>
                        <Link
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 no-underline hover:no-underline transition-colors',
                            activeSpaceBannerUrl
                              ? 'bg-white/15 border-white/25 text-white hover:bg-white/25 hover:text-white'
                              : 'bg-foreground/10 border-foreground/20 text-foreground/80 hover:bg-foreground/20 hover:text-foreground dark:bg-white/15 dark:border-white/25 dark:text-white/90 dark:hover:bg-white/25 dark:hover:text-white'
                          )}
                          to={spaceUrl(groupSlug, localSpaceSlug(groupSlug, activeSpaceGroup.slug), 'members')}
                          onClick={() => dispatch(toggleNavMenu(false))}
                          aria-label={t('{{count}} Members', { count: activeSpaceGroup.memberCount })}
                        >
                          <Users className='w-3.5 h-3.5' />
                          {activeSpaceGroup.memberCount}
                        </Link>
                        <InviteMembersDialog
                          group={activeSpaceGroup}
                          parentGroup={group}
                          alwaysVisible
                          triggerLabel={t('Invite')}
                          triggerClassName={cn(
                            'rounded-full border px-2 py-0.5 hover:scale-100',
                            activeSpaceBannerUrl
                              ? 'bg-white/15 border-white/25 text-white hover:bg-white/25 hover:text-white'
                              : 'bg-foreground/10 border-foreground/20 text-foreground/80 hover:bg-foreground/20 hover:text-foreground dark:bg-white/15 dark:border-white/25 dark:text-white/90 dark:hover:bg-white/25 dark:hover:text-white'
                          )}
                        />
                      </span>
                    </div>
                    <Link
                      to={spaceUrl(groupSlug, localSpaceSlug(groupSlug, activeSpaceGroup.slug), 'about')}
                      onClick={() => dispatch(toggleNavMenu(false))}
                      className={cn(
                        'shrink-0 transition-all hover:scale-110',
                        activeSpaceBannerUrl
                          ? 'text-white/80 hover:text-white'
                          : 'text-foreground/60 hover:text-foreground dark:text-white/80 dark:hover:text-white'
                      )}
                      aria-label={t('About')}
                      title={t('About')}
                    >
                      <Info className='w-5 h-5' />
                    </Link>
                  </div>
                </div>
                {spaceMenuViews.length > 0 || isEditing
                  ? (
                    <GroupViewList
                      groupViews={spaceMenuViews}
                      group={activeSpaceGroup}
                      groupSlug={groupSlug}
                      spaceSlug={spaceSlug}
                      spaceGroup={activeSpaceGroup}
                      parentGroup={group}
                      isEditing={isEditing}
                      onOpenSettings={setSettingsView}
                      canAdminister={canAdminister}
                    />
                    )
                  : spaceViewsLoading
                    ? (
                      <div className='p-3 text-foreground/40 text-sm'>
                        {t('Loading views…')}
                      </div>
                      )
                    : null}
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
                  canAdminister={canAdminister}
                />
                )
              : groupViewsLoading
                ? (
                  <div className='p-3 text-foreground/40 text-sm'>
                    {t('Loading views…')}
                  </div>
                  )
                : null}
          {menuFooter}
          {settingsView && (
            settingsView.type === 'space'
              ? (
                <SpaceSettingsModal
                  view={settingsView}
                  space={settingsView.linkedGroup}
                  parentGroup={group}
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
                : settingsView.type === 'space-collection'
                  ? (
                    <AddSpaceCollectionDialog
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
