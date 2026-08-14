import { cn, bgImageStyle } from 'util/index'
import { isDrawerNavLayout } from 'util/mobile'
import { Info, Settings, Users, Pencil, X, CircleEllipsis, ChevronLeft, UserPlus } from 'lucide-react'
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import InviteMembersPopover from 'components/InviteMembersPopover/InviteMembersPopover'
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews,
  MANAGE_ROUND_VIEW
} from '@hylo/presenters/GroupViewPresenter'
import {
  groupUrl,
  addQuerystringToPath,
  localSpaceSlug,
  personUrl,
  spaceUrl
} from '@hylo/navigation'
import { replace } from 'redux-first-history'
import { WebViewMessageTypes } from '@hylo/shared'
import { sendMessageToWebView } from 'util/webView'
import logout from 'store/actions/logout'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { getMoreViewsSections } from 'store/selectors/getMoreSpacesSections'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import { RESP_ADMINISTRATION, RESP_ADD_MEMBERS, FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS, FETCH_GROUP_VIEWS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { filterMoreSpacesSections, filterSpaceViewsForMenuVisibility, spaceMenuVisibilityOpts } from 'util/spaceVisibility'
import useAppearance from 'hooks/useAppearance'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import { createGroupView, deleteGroupView, deleteSpace, setGroupViewHidden } from 'store/actions/groupViews'
import { canHardDeleteView, viewAcceptedByPostTypes } from 'store/models/GroupView'
import { viewShowsUnreadDot, viewUnreadBadgeCount } from 'util/viewUnreadBadges'
import GroupMenuHeader from 'components/GroupMenuHeader'
import GroupNotificationsPopover from 'components/GroupNotificationsPopover/GroupNotificationsPopover'
import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import MenuRowBackground from './MenuRowBackground'
import SortableViewsGrid from './SortableViewsGrid'
import GroupViewCard, { SpaceViewCard, EventDateStack } from './GroupViewCard'
import ViewsGridSkeleton from './ViewsGridSkeleton'
import {
  viewCardColor,
  eventStartForView,
  inkOn,
  cardGradient,
  cardFieldTint,
  cardHoverRing,
  cardRestRing,
  cardNeutralBg,
  cardFadeGradient,
  cardChrome,
  cardHoverShadow,
  cardRestShadow,
  CARD_CLASS,
  CARD_FADE_CLASS,
  CARD_TITLE_CLASS,
  CARD_W,
  CARD_H
} from './viewCardTheme'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddGroupViewDialog from './AddGroupViewDialog'
import AddSpaceDialog from './AddSpaceDialog'
import AddViewOrSpaceMenu from './AddViewOrSpaceMenu'
import EditingBottomBar, { EDITING_BAR_BUTTON_CLASS } from './EditingBottomBar'
import { menuViewUrl } from './groupViewMenuUrl'

/** Synthetic view so the More Views card can use the same icon wallpaper as real views. */
const MORE_SPACES_VIEW = { lucideIcon: 'CircleEllipsis' }
const JOIN_REQUESTS_VIEW = { lucideIcon: 'UserPlus' }

/**
 * Splits ordered views into grid sections.
 * Text and separator views break the grid onto their own full-width rows;
 * views between breaks flow in a shared wrap grid.
 */
function partitionViewsIntoSections (views) {
  const sections = []
  let currentGrid = []

  const flushGrid = () => {
    if (currentGrid.length === 0) return
    sections.push({ type: 'grid', views: currentGrid })
    currentGrid = []
  }

  for (const view of views) {
    if (view.type === 'text' || view.type === 'separator') {
      flushGrid()
      sections.push({ type: view.type, view })
      continue
    }
    currentGrid.push(view)
  }
  flushGrid()
  return sections
}

/** Sticky back bar for nested grid levels. */
/**
 * Space-level takeover header for the one-column layout, laid out like the
 * group dashboard banner: identity centered, notifications top-left, about +
 * settings top-right. Its height plus the ducked group header (h-12) equals
 * the full group banner (220px), so the takeover swaps hierarchy without
 * moving the grid below.
 */
function SpaceBannerHeader ({ group, spaceGroup, canAdminister, onOpenSettings, navigate, t }) {
  const location = useLocation()
  const presentedSpaceView = useMemo(() => GroupViewPresenter({
    type: 'space', name: spaceGroup.name, icon: spaceGroup.icon, linkedGroup: spaceGroup
  }), [spaceGroup])
  const bannerUrl = spaceGroup.bannerUrl && spaceGroup.bannerUrl !== DEFAULT_BANNER ? spaceGroup.bannerUrl : null
  const localSpace = localSpaceSlug(group.slug, spaceGroup.slug)
  // White identity over a photo; theme foreground over the pale glyph texture
  const inkClass = bannerUrl ? 'text-white' : 'text-foreground dark:text-white'
  const controlClass = bannerUrl
    ? 'text-white/90 hover:text-white'
    : 'text-foreground/60 hover:text-foreground dark:text-white/80 dark:hover:text-white'
  const pillClass = bannerUrl
    ? 'bg-white/15 border-white/25 text-white hover:bg-white/25 hover:text-white'
    : 'bg-foreground/10 border-foreground/20 text-foreground/80 hover:bg-foreground/20 hover:text-foreground dark:bg-white/15 dark:border-white/25 dark:text-white/90 dark:hover:bg-white/25 dark:hover:text-white'

  return (
    <div className='SpaceBannerHeader relative z-20 h-[172px] overflow-hidden border-b border-foreground/10 shadow-md'>
      {bannerUrl
        ? (
          <>
            <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bannerUrl)} />
            <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.6) 100%)' }} />
          </>
          )
        : <MenuRowBackground view={presentedSpaceView} bannerUrl={null} glyphCount={360} />}

      {/* Controls bar, mirroring the group banner: bell left, about + settings right */}
      <div className='absolute top-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-[1000px] px-3 flex items-center justify-between'>
        <div className={controlClass}>
          <GroupNotificationsPopover group={spaceGroup} className='w-6 h-6 drop-shadow-md hover:scale-110 transition-all' />
        </div>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => navigate(addQuerystringToPath(location.pathname, { about: 1 }))}
            aria-label={t('About')}
            title={t('About')}
          >
            <Info className={cn('w-6 h-6 drop-shadow-md hover:scale-110 transition-all', controlClass)} />
          </button>
          {canAdminister && (
            <button type='button' onClick={onOpenSettings} aria-label={t('Space Settings')} title={t('Space Settings')}>
              <Settings className={cn('w-6 h-6 drop-shadow-md hover:scale-110 transition-all', controlClass)} />
            </button>
          )}
        </div>
      </div>

      {/* Identity centered, like the group banner */}
      <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-1'>
        <div
          style={presentedSpaceView?.avatarUrl ? bgImageStyle(presentedSpaceView.avatarUrl) : {}}
          className={cn(
            'w-14 h-14 rounded-xl shadow-lg bg-cover bg-center border-2 border-white/30 overflow-hidden relative grid place-items-center',
            !presentedSpaceView?.avatarUrl && 'bg-theme-background'
          )}
        >
          {/* theme-background is dark in every theme, so the icon is always light */}
          {!presentedSpaceView?.avatarUrl && (
            <GroupViewIcon view={presentedSpaceView} className='!w-7 !h-7 !mr-0 text-white/90' />
          )}
        </div>
        <h1 className={cn('text-xl font-bold drop-shadow-md m-0 leading-tight max-w-[80%] truncate', inkClass)}>{spaceGroup.name}</h1>
        <span className={cn('flex items-center gap-1 text-xs', inkClass)}>
          <Link
            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 no-underline hover:no-underline transition-colors', pillClass)}
            to={spaceUrl(group.slug, localSpace, 'members')}
            aria-label={t('{{count}} Members', { count: spaceGroup.memberCount })}
          >
            <Users className='w-3.5 h-3.5' />
            {spaceGroup.memberCount}
          </Link>
          <InviteMembersPopover
            group={spaceGroup}
            alwaysVisible
            triggerLabel={t('Invite')}
            triggerClassName={cn('rounded-full border px-2 py-0.5 hover:scale-100', pillClass)}
          />
        </span>
      </div>
    </div>
  )
}

function StickyBackHeader ({ title, onBack, t }) {
  return (
    <div className='sticky top-0 z-30 -mx-4 px-4 py-3 mb-2 bg-background/95 backdrop-blur-sm border-b border-foreground/10 flex items-center gap-2'>
      <button
        type='button'
        onClick={onBack}
        className='flex items-center gap-1 text-foreground/70 hover:text-foreground transition-colors shrink-0'
        aria-label={t('Back')}
      >
        <ChevronLeft className='w-5 h-5' />
        <span className='text-sm font-medium'>{t('Back')}</span>
      </button>
      {title && (
        <h2 className='text-base font-semibold text-foreground truncate flex-1 text-center pr-14'>
          {title}
        </h2>
      )}
    </div>
  )
}

/**
 * Full-width text header row in the grid menu. Owns the space above itself so a
 * heading sits closer to the cards it labels than to the section before it. The
 * other callers nest it as the first child of their own gap-3 column, where
 * `first:` zeroes this out and their wrapper handles the spacing.
 */
function TextSection ({ children }) {
  return (
    <h2 className='text-base font-semibold text-foreground/70 px-1 w-full mt-3 first:mt-0'>
      {children}
    </h2>
  )
}

/** Full-width separator row in the grid menu. */
function SeparatorSection () {
  return <hr className='border-foreground/15 w-full' />
}

/** Renders partitioned view sections as a card grid. */
function ViewsGrid ({ sections, groupSlug, group, spaceGroup, navigate, t }) {
  return (
    // Headings and card rows are flat siblings here, so the gap is the heading's
    // distance from its own cards — it matches the gap between cards, and
    // TextSection's own top margin is what separates one section from the next.
    <div className='flex flex-col gap-3'>
      {sections.map((section, index) => {
        if (section.type === 'text') {
          const presented = GroupViewPresenter(section.view)
          return (
            <TextSection key={section.view.id || `text-${index}`}>
              {displayNameForView(presented, t, { spaceGroup })}
            </TextSection>
          )
        }
        if (section.type === 'separator') {
          return <SeparatorSection key={section.view.id || `sep-${index}`} />
        }
        return (
          <div key={`grid-${index}`} className='flex flex-wrap gap-3'>
            {section.views.map(view => (
              <ViewCard
                key={view.id}
                view={view}
                groupSlug={groupSlug}
                group={group}
                spaceGroup={spaceGroup}
                navigate={navigate}
                t={t}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** Single navigable view card in the grid. */
function ViewCard ({ view, groupSlug, group, spaceGroup, navigate, t }) {
  const dispatch = useDispatch()
  const [hover, setHover] = useState(false)
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])
  const title = displayNameForView(presentedView, t, { spaceGroup })
  const url = menuViewUrl(groupSlug, presentedView, spaceGroup)
  const isExternal = presentedView.type === 'link' && url && /^https?:\/\//.test(url)
  const isWelcome = presentedView.type === 'welcome'
  const welcomeText = isWelcome && (presentedView.pageContent || group?.welcomePage)
    ? (presentedView.pageContent || group.welcomePage).replace(/<[^>]*>/g, '').trim()
    : null
  const isSpace = presentedView.type === 'space'
  const isLogout = presentedView.type === 'logout'
  const { effectiveColorScheme } = useAppearance()

  // Image-backed cards (spaces, groups, members) show the group's banner when
  // one is set — even without a custom avatar — falling back to the avatar;
  // icon cards use the view color (post-type brand, or slate grey otherwise).
  const linkedGroup = presentedView.linkedGroup
  const linkedGroupBanner = linkedGroup?.bannerUrl && linkedGroup.bannerUrl !== DEFAULT_BANNER
    ? linkedGroup.bannerUrl
    : null
  const bgImageUrl = linkedGroupBanner || presentedView.avatarUrl || null
  const isDark = effectiveColorScheme === 'dark'
  const col = viewCardColor(presentedView)
  const tint = cardFieldTint(col, effectiveColorScheme)
  const ink = inkOn(col)
  // Photo-backed cards keep white-on-scrim labels in both schemes.
  const lightSurfaceLabels = !isDark && !bgImageUrl
  // Map/welcome cards keep their extra content, so their icon+label stay in a
  // flowing column; plain cards center the tile exactly per the design.
  const hasExtraContent = Boolean(isWelcome && welcomeText)

  const handleClick = async () => {
    if (isLogout) {
      await dispatch(logout())
      if (window.HyloMobileV2) {
        sendMessageToWebView(WebViewMessageTypes.LOGOUT)
      } else {
        dispatch(replace('/login', null))
      }
      return
    }
    if (isSpace && presentedView.linkedGroup) {
      const local = localSpaceSlug(groupSlug, presentedView.linkedGroup.slug)
      navigate(spaceUrl(groupSlug, local))
      return
    }
    if (isExternal && url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    if (url) navigate(url)
  }

  const chatBadgeCount = viewUnreadBadgeCount(presentedView)
  const showUnreadDot = viewShowsUnreadDot(presentedView)
  const liveSpaceGroup = useSelector(state =>
    isSpace && presentedView.linkedGroup?.slug
      ? getGroupForSlug(state, presentedView.linkedGroup.slug)
      : null
  )
  const showJoinRequestDot = isSpace && (
    (liveSpaceGroup?.openJoinRequestCount || presentedView.linkedGroup?.openJoinRequestCount || 0) > 0
  )
  const eventStart = eventStartForView(presentedView)
  const myMemberships = useSelector(getMyMemberships)
  const isSpaceMember = Boolean(
    isSpace && linkedGroup &&
    myMemberships.some(m => String(m.group.id) === String(linkedGroup.id))
  )
  const spaceMemberCount = isSpace ? (linkedGroup?.memberCount ?? null) : null
  // Members see the space's member count; non-members get a + JOIN hint instead
  const spacePill = isSpace && (typeof spaceMemberCount === 'number' || !isSpaceMember)
    ? (
      <span
        className={cn(
          'absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 text-xs leading-none rounded-full px-1.5 py-1',
          lightSurfaceLabels
            ? 'bg-black/10 text-foreground/60'
            : 'bg-black/30 text-white/90 backdrop-blur-sm'
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
      )
    : null

  const iconTile = (
    <div
      className='w-14 h-14 rounded-[15px] overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
      style={presentedView.avatarUrl
        ? { border: '1px solid hsl(0 0% 100% / 0.28)' }
        : bgImageUrl
          ? { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid hsl(0 0% 100% / 0.28)' }
          : { background: col, color: ink, border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
    >
      {/* An avatar fills the tile — RoundImage hard-codes its own small size, so it
          can't be scaled up through GroupViewIcon's className. */}
      {presentedView.avatarUrl
        ? <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(presentedView.avatarUrl)} />
        : eventStart
          ? <EventDateStack start={eventStart} />
          : (
            <span className='flex items-center justify-center w-[26px] h-[26px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[26px] [&>span]:!leading-none'>
              <GroupViewIcon view={presentedView} className='!w-[26px] !h-[26px] !mr-0' />
            </span>
            )}
    </div>
  )

  const label = (
    <h3 className={cn(
      CARD_TITLE_CLASS,
      lightSurfaceLabels ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]'
    )}
    >{title}
    </h3>
  )

  const isMembers = presentedView.type === 'members'
  const inviteGroup = spaceGroup || group

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(CARD_CLASS, cardChrome(isDark), 'group')}
      style={{
        background: bgImageUrl
          ? cardNeutralBg(effectiveColorScheme)
          : cardGradient(col, effectiveColorScheme),
        // Light mode: icon cards take their border from the view color (brand or grey)
        // Light mode: icon cards take the view color — faint at rest, full on hover
        ...(!isDark && !bgImageUrl ? { borderColor: hover ? col : `${col}33` } : {}),
        // Photo-backed cards read better with a soft white edge than a dark hairline
        ...(!isDark && bgImageUrl ? { borderColor: `hsl(0 0% 100% / ${hover ? 0.55 : 0.25})` } : {}),
        boxShadow: hover
          ? `${cardHoverShadow(isDark)}, ${bgImageUrl ? cardRestRing(col) : cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {isMembers && inviteGroup && (
        <div className='absolute top-1.5 right-1.5 z-20'>
          <InviteMembersPopover
            group={inviteGroup}
            triggerClassName={lightSurfaceLabels
              ? 'bg-background/90 text-foreground/70 hover:text-foreground shadow-sm'
              : 'bg-black/40 text-white hover:text-white shadow-sm'}
          />
        </div>
      )}
      {bgImageUrl
        ? (
          <>
            <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
            <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
          </>
          )
        : (
          <>
            <CardIconField view={presentedView} tint={tint} w={CARD_W} h={CARD_H} />
            <div className={CARD_FADE_CLASS} style={{ background: cardFadeGradient(effectiveColorScheme) }} />
          </>
          )}

      {spacePill}
      {(showUnreadDot || showJoinRequestDot) && (
        <span className='absolute -top-1.5 -right-1.5 z-10 w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
      )}
      {chatBadgeCount != null && (
        <span className='absolute -top-1.5 -right-1.5 z-10 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center border-2 border-background'>
          {chatBadgeCount}
        </span>
      )}

      {hasExtraContent
        ? (
          <div className='relative h-full flex flex-col p-2 sm:p-3'>
            <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
              {iconTile}
              {label}
            </div>
            {isWelcome && welcomeText && (
              <p className={cn(
                'm-0 px-1 text-xs line-clamp-2 leading-relaxed',
                lightSurfaceLabels ? 'text-foreground/70' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'
              )}
              >{welcomeText}
              </p>
            )}
          </div>
          )
        : (
          <div className='relative h-full'>
            <div className='absolute inset-0 grid place-items-center'>
              {iconTile}
            </div>
            <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
              {label}
            </div>
          </div>
          )}
    </div>
  )
}

/** Card opening the More Views and Spaces nested grid. */
function MoreSpacesCard ({ onClick, t }) {
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  // Not a post-type view, so it takes the same slate grey as every other neutral card
  const col = viewCardColor(null)
  const tint = cardFieldTint(col, effectiveColorScheme)
  return (
    <div
      onClick={onClick}
      className={cn(CARD_CLASS, cardChrome(isDark))}
      style={{
        background: cardGradient(col, effectiveColorScheme),
        ...(!isDark ? { borderColor: hover ? col : `${col}33` } : {}),
        boxShadow: hover
          ? `${cardHoverShadow(isDark)}, ${cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardIconField view={MORE_SPACES_VIEW} tint={tint} w={CARD_W} h={CARD_H} />
      <div className={CARD_FADE_CLASS} style={{ background: cardFadeGradient(effectiveColorScheme) }} />
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          {/* Same solid tile as the icon cards, so this reads as one of them */}
          <div
            className='w-14 h-14 rounded-[15px] grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            style={{ background: col, color: inkOn(col), border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            <CircleEllipsis className='w-7 h-7' />
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn(CARD_TITLE_CLASS, isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>{t('More')}</h3>
        </div>
      </div>
    </div>
  )
}

/** Card opening Group Settings → Join Requests, shown when there are pending requests. */
function JoinRequestsCard ({ count, onClick, t }) {
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  const col = viewCardColor(null)
  const tint = cardFieldTint(col, effectiveColorScheme)
  return (
    <div
      onClick={onClick}
      className={cn(CARD_CLASS, cardChrome(isDark))}
      style={{
        background: cardGradient(col, effectiveColorScheme),
        ...(!isDark ? { borderColor: hover ? col : `${col}33` } : {}),
        boxShadow: hover
          ? `${cardHoverShadow(isDark)}, ${cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role='button'
      tabIndex={0}
      aria-label={t('Join Requests')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardIconField view={JOIN_REQUESTS_VIEW} tint={tint} w={CARD_W} h={CARD_H} />
      <div className={CARD_FADE_CLASS} style={{ background: cardFadeGradient(effectiveColorScheme) }} />
      {count > 0 && (
        <span className='absolute -top-1.5 -right-1.5 z-10 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center border-2 border-background'>
          {count}
        </span>
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className='w-14 h-14 rounded-[15px] grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            style={{ background: col, color: inkOn(col), border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            <UserPlus className='w-7 h-7' />
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn(CARD_TITLE_CLASS, isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>{t('Join Requests')}</h3>
        </div>
      </div>
    </div>
  )
}

/**
 * Everything behind More Views and Spaces: the visible sections, whether there is
 * anything there at all, and whether we are still finding out. One hook so the
 * card that links here can't disagree with what this page would render — the
 * off-menu views come from groupViews, but the track/round/space buckets need
 * spaces to have been fetched, so a caller that hasn't fetched them would think
 * the page was empty.
 */
function useMoreSpacesContent (group) {
  const { t } = useTranslation()
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const sectionsRaw = useSelector(state => getMoreViewsSections(state, group))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: group?.id
  }))
  const publishedOfferings = usePublishedOfferings(group?.id)
  const sections = useMemo(
    () => filterMoreSpacesSections(sectionsRaw, spaceMenuVisibilityOpts({
      offerings: publishedOfferings,
      canManageSpaces,
      memberships: myMemberships,
      currentUser,
      parentGroupId: group?.id
    })),
    [sectionsRaw, publishedOfferings, canManageSpaces, myMemberships, currentUser, group?.id]
  )
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const childGroups = useSelector(state => getChildGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )
  const hasRelatedGroups = parentGroups.length + childGroups.length + peerGroups.length > 0

  const offMenuViews = useMemo(() => {
    const views = (sections.offMenuViews || []).filter(view => {
      if (view.type === 'related-groups' && !hasRelatedGroups) return false
      return true
    })
    return [...views].sort((a, b) =>
      displayNameForView(GroupViewPresenter(a), t).localeCompare(
        displayNameForView(GroupViewPresenter(b), t)
      )
    )
  }, [sections.offMenuViews, hasRelatedGroups])

  const showViews = offMenuViews.length > 0
  const showTracks = sections.trackSpaces?.length > 0
  const showFundingRounds = sections.fundingRoundSpaces?.length > 0
  const showOtherSpaces = sections.otherSpaces?.length > 0

  return {
    sections,
    offMenuViews,
    canManageSpaces,
    pending,
    showViews,
    showTracks,
    showFundingRounds,
    showOtherSpaces,
    hasContent: showViews || showTracks || showFundingRounds || showOtherSpaces
  }
}

/** Nested More Views and Spaces grid with section headers. Supports edit mode actions. */
function MoreSpacesGrid ({
  group,
  groupSlug,
  navigate,
  t,
  isEditing = false,
  onOpenSettings,
  onOpenSpaceSettings
}) {
  const dispatch = useDispatch()
  const {
    sections,
    offMenuViews,
    pending,
    showViews,
    showTracks,
    showFundingRounds,
    showOtherSpaces,
    hasContent
  } = useMoreSpacesContent(group)
  const groupViews = useSelector(state => getGroupViews(state, group))
  const [deletingSpaceId, setDeletingSpaceId] = useState(null)

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
    dispatch(fetchGroupViews(group.id))
  }, [dispatch, group?.id, groupSlug])

  const handleOpenSpace = useCallback((space) => {
    if (isEditing) return
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local), { state: { fromMoreViews: true } })
  }, [groupSlug, navigate, isEditing])

  const handleOpenSpaceAbout = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local, '/about'))
  }, [groupSlug, navigate])

  const handleOpenView = useCallback((view) => {
    if (isEditing) return
    const presented = GroupViewPresenter(view)
    const url = menuViewUrl(groupSlug, presented)
    if (url) navigate(url)
  }, [groupSlug, navigate, isEditing])

  const handleAddViewToMenu = useCallback(async (view) => {
    if (!group?.id || !view?.id) return
    try {
      await dispatch(setGroupViewHidden({ id: view.id, groupId: group.id, hidden: false }))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to add view to menu:', error)
    }
  }, [dispatch, group?.id])

  const handleAddSpaceToMenu = useCallback(async (space) => {
    if (!group?.id || !space?.id) return
    try {
      const existing = (groupViews || []).find(v =>
        v.type === 'space' && String(v.linkedGroup?.id) === String(space.id)
      )
      if (existing?.id) {
        await dispatch(setGroupViewHidden({ id: existing.id, groupId: group.id, hidden: false }))
      } else {
        await dispatch(createGroupView({
          groupId: group.id,
          type: 'space',
          linkedGroupId: space.id,
          addToEnd: true
        }))
      }
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchGroupSpaces(group.id))
    } catch (error) {
      console.error('Failed to add space to menu:', error)
    }
  }, [dispatch, group?.id, groupViews])

  const handleDeleteView = useCallback(async (view) => {
    if (!canHardDeleteView(view) || !group?.id) return
    const label = displayNameForView(GroupViewPresenter(view), t)
    if (!window.confirm(t('Are you sure you want to permanently delete {{name}}?', { name: label }))) return
    try {
      await dispatch(deleteGroupView(view.id, group.id))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to delete view:', error)
    }
  }, [dispatch, group?.id, t])

  const handleDeleteSpace = useCallback(async (space) => {
    if (!space?.id || deletingSpaceId) return
    const confirmed = window.confirm(
      t('Are you sure you want to permanently delete {{name}}? Posts in this space will no longer be accessible.', {
        name: space.name
      })
    )
    if (!confirmed) return
    setDeletingSpaceId(space.id)
    try {
      await dispatch(deleteSpace(space.id))
      await dispatch(fetchGroupSpaces(group.id))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to delete space:', error)
    } finally {
      setDeletingSpaceId(null)
    }
  }, [dispatch, group?.id, deletingSpaceId, t])

  if (pending && !hasContent) {
    return <ViewsGridSkeleton />
  }

  if (!hasContent) {
    return <p className='text-sm text-foreground/40'>{t('Nothing here yet')}</p>
  }

  return (
    <div className='flex flex-col gap-6'>
      {showViews && (
        <div className='flex flex-col gap-3'>
          <TextSection>{t('Views')}</TextSection>
          <div className='flex flex-wrap gap-3'>
            {offMenuViews.map(view => (
              <GroupViewCard
                key={view.id}
                view={view}
                isEditing={isEditing}
                onAddToMenu={handleAddViewToMenu}
                onOpen={handleOpenView}
                onOpenSettings={onOpenSettings}
                onDelete={canHardDeleteView(view) ? handleDeleteView : null}
              />
            ))}
          </div>
        </div>
      )}
      {showTracks && (
        <div className='flex flex-col gap-3'>
          <TextSection>{t('Tracks')}</TextSection>
          <div className='flex flex-wrap gap-3'>
            {sections.trackSpaces.map(space => (
              <SpaceViewCard
                key={space.id}
                space={space}
                isEditing={isEditing}
                isDeleting={String(deletingSpaceId) === String(space.id)}
                onOpen={handleOpenSpace}
                onOpenAbout={handleOpenSpaceAbout}
                onAddToMenu={handleAddSpaceToMenu}
                onOpenSettings={onOpenSpaceSettings}
                onDelete={handleDeleteSpace}
              />
            ))}
          </div>
        </div>
      )}
      {showFundingRounds && (
        <div className='flex flex-col gap-3'>
          <TextSection>{t('Funding Rounds')}</TextSection>
          <div className='flex flex-wrap gap-3'>
            {sections.fundingRoundSpaces.map(space => (
              <SpaceViewCard
                key={space.id}
                space={space}
                isEditing={isEditing}
                isDeleting={String(deletingSpaceId) === String(space.id)}
                onOpen={handleOpenSpace}
                onOpenAbout={handleOpenSpaceAbout}
                onAddToMenu={handleAddSpaceToMenu}
                onOpenSettings={onOpenSpaceSettings}
                onDelete={handleDeleteSpace}
              />
            ))}
          </div>
        </div>
      )}
      {showOtherSpaces && (
        <div className='flex flex-col gap-3'>
          <TextSection>{t('Other Spaces')}</TextSection>
          <div className='flex flex-wrap gap-3'>
            {sections.otherSpaces.map(space => (
              <SpaceViewCard
                key={space.id}
                space={space}
                isEditing={isEditing}
                isDeleting={String(deletingSpaceId) === String(space.id)}
                onOpen={handleOpenSpace}
                onOpenAbout={handleOpenSpaceAbout}
                onAddToMenu={handleAddSpaceToMenu}
                onOpenSettings={onOpenSpaceSettings}
                onDelete={handleDeleteSpace}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Full-screen grid context menu for card-menu (one-column) layouts.
 * Group mode: group menu → more spaces / space menu → view.
 * Context mode: My / All / Public static menus via `context`.
 *
 * @param {object} [group] - Parent group (group mode)
 * @param {object} [spaceGroup] - When set, renders that space's views (space menu level)
 * @param {string} [context] - 'my' | 'all' | 'public' for static context menus
 */
export default function ContextMenuGrid ({ group = null, spaceGroup = null, context = null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const groupSlug = group?.slug
  const isContextMode = Boolean(context) && !group

  const isMoreSpacesLevel = !isContextMode && !spaceGroup && location.pathname.replace(/\/$/, '').endsWith('/more-views')
  const isSpaceLevel = Boolean(spaceGroup)
  const isNestedLevel = isMoreSpacesLevel || isSpaceLevel

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: (spaceGroup || group)?.id
  }))
  const canAddMembers = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADD_MEMBERS,
    groupId: (spaceGroup || group)?.id
  }))
  const isEditing = !isContextMode && getQuerystringParam('edit', location) === 'true' && canAdminister && !isMoreSpacesLevel
  const [settingsView, setSettingsView] = useState(null)
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)
  // EditingBottomBar measures this to size itself to the column
  const gridContainerRef = useRef(null)

  // Reset breadcrumb; nested levels use the sticky back bar instead of ViewHeader.
  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({})
  }, [setHeaderDetails, groupSlug, spaceGroup?.id, isMoreSpacesLevel, context])

  const menuGroup = spaceGroup || group

  useEffect(() => {
    if (!isContextMode && menuGroup?.id) dispatch(fetchGroupViews(menuGroup.id))
  }, [dispatch, menuGroup?.id, isContextMode])

  // Whether to offer More Views and Spaces at all. MoreSpacesGrid fetches these
  // itself once you are on that level, so only fetch here — where the card lives —
  // to avoid asking twice.
  const moreSpaces = useMoreSpacesContent(group)
  const showMoreSpacesCard = moreSpaces.hasContent || moreSpaces.pending
  useEffect(() => {
    if (isContextMode || isMoreSpacesLevel || spaceGroup || !group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
  }, [dispatch, isContextMode, isMoreSpacesLevel, spaceGroup, group?.id, groupSlug])

  const groupViews = useSelector(state => isContextMode ? [] : getGroupViews(state, menuGroup))
  const viewsPending = useSelector(state => isPendingFor(FETCH_GROUP_VIEWS, state))
  const viewsLoading = viewsPending && groupViews.length === 0
  const publishedOfferings = usePublishedOfferings(group?.id)
  const spaceVisibilityOpts = useMemo(() => spaceMenuVisibilityOpts({
    offerings: publishedOfferings,
    canManageSpaces: canAdminister,
    memberships: myMemberships,
    currentUser,
    parentGroupId: group?.id
  }), [publishedOfferings, canAdminister, myMemberships, currentUser, group?.id])

  const handleDeleteMenuView = useCallback(async (view) => {
    if (!canHardDeleteView(view) || !menuGroup?.id) return
    const label = displayNameForView(GroupViewPresenter(view), t)
    if (!window.confirm(t('Are you sure you want to permanently delete {{name}}?', { name: label }))) return
    try {
      await dispatch(deleteGroupView(view.id, menuGroup.id))
      await dispatch(fetchGroupViews(menuGroup.id))
    } catch (error) {
      console.error('Failed to delete view:', error)
    }
  }, [dispatch, menuGroup?.id, t])

  const visibleViews = useMemo(() => {
    if (isContextMode) {
      const profileUrl = personUrl(currentUser?.id)
      return getStaticMenuViews({
        isPublicContext: context === 'public',
        isMyContext: context === 'my' || context === 'all',
        profileUrl
      }) || []
    }
    const views = filterSpaceViewsForMenuVisibility(
      (groupViews || [])
        .filter(view => view.order != null)
        .filter(view => viewAcceptedByPostTypes(view.type, menuGroup?.acceptedPostTypes)),
      spaceVisibilityOpts
    )
    if (spaceGroup?.fundingRound?.id && canAdminister) {
      return [...views, MANAGE_ROUND_VIEW]
    }
    return views
  }, [isContextMode, context, currentUser?.id, groupViews, menuGroup?.acceptedPostTypes, spaceGroup?.fundingRound?.id, canAdminister, spaceVisibilityOpts])

  const sections = useMemo(() => partitionViewsIntoSections(visibleViews), [visibleViews])

  const bannerUrl = isContextMode
    ? (context === 'public' ? '/the-commons.jpg' : (currentUser?.bannerUrl || '/default-user-banner.svg'))
    : ((spaceGroup || group)?.bannerUrl || group?.bannerUrl || DEFAULT_BANNER)
  const avatarUrl = isContextMode
    ? (context === 'public' ? null : (currentUser?.avatarUrl || DEFAULT_AVATAR))
    : ((spaceGroup || group)?.avatarUrl || DEFAULT_AVATAR)
  const isDefaultAvatar = !avatarUrl || avatarUrl === DEFAULT_AVATAR
  const displayName = isContextMode
    ? (context === 'public' ? t('The Commons') : t('My Home'))
    : (spaceGroup?.name || group?.name)
  const displaySubtitle = isContextMode && context !== 'public' && currentUser?.name
    ? `${currentUser.name}${currentUser.email ? ` (${currentUser.email})` : ''}`
    : null

  const handleBack = useCallback(() => {
    if (isSpaceLevel && location.state?.fromMoreViews) {
      navigate(groupUrl(groupSlug, 'more-views'))
      return
    }
    if (isSpaceLevel || isMoreSpacesLevel) {
      navigate(groupUrl(groupSlug))
      return
    }
    navigate(-1)
  }, [isSpaceLevel, isMoreSpacesLevel, location.state, groupSlug, navigate])

  const toggleEditing = useCallback(() => {
    if (isEditing) {
      const params = new URLSearchParams(location.search)
      params.delete('edit')
      const newSearch = params.toString()
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`)
      return
    }
    navigate(addQuerystringToPath(location.pathname, { edit: 'true' }))
  }, [isEditing, location.pathname, location.search, navigate])

  const nestedTitle = isMoreSpacesLevel
    ? t('More')
    : (spaceGroup?.name || t('Space'))

  return (
    <div className='ContextMenuGrid w-full h-full overflow-y-auto' id='context-menu-grid'>
      {/* Space level mirrors the two-column takeover: ducked group header (back
          chevron) with the space's own banner header below it */}
      {isSpaceLevel && group && spaceGroup && (
        <>
          <GroupMenuHeader group={group} compact centered onCompactClick={handleBack} />
          <SpaceBannerHeader
            group={group}
            spaceGroup={spaceGroup}
            canAdminister={canAdminister}
            onOpenSettings={() => setSettingsView({ type: 'space', linkedGroup: spaceGroup, name: spaceGroup.name, icon: spaceGroup.icon })}
            navigate={navigate}
            t={t}
          />
        </>
      )}
      {/* Banner — root group/context menu only. Not for a space on a drawer layout:
          ViewHeader already names the space there, and the two stacked headers read
          as a mistake on a phone's height */}
      {!isNestedLevel && !(spaceGroup && isDrawerNavLayout()) && (
        <div className='relative w-full'>
          <div id='context-menu-grid-banner' className='relative h-[220px] overflow-hidden'>
            <div className='absolute inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
            <div className='absolute inset-0 bg-darkening/50' />

            {!isContextMode && (
              <div className='absolute top-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-[1000px] px-3 flex items-center justify-between'>
                <GroupNotificationsPopover group={group} />

                {/* Matches GroupMenuHeader's affordances — about, then settings */}
                <div className='flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => navigate(groupUrl(groupSlug, 'about', {}))}
                    aria-label={t('About')}
                  >
                    <Info className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                  </button>

                  {canAdminister && (
                    <button type='button' onClick={() => navigate(groupUrl(groupSlug, 'settings', {}))}>
                      <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-1'>
              {context !== 'public' && (
                <div
                  className={cn('w-16 h-16 rounded-xl shadow-lg bg-cover bg-center border-2 border-white/30 overflow-hidden relative', { 'bg-darkening': isDefaultAvatar })}
                  style={!isDefaultAvatar ? bgImageStyle(avatarUrl) : {}}
                >
                  {isDefaultAvatar && (
                    <>
                      <div className='absolute inset-0 opacity-70' style={{ background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))' }} />
                      <span className='relative z-10 text-white text-2xl flex items-center justify-center uppercase h-full drop-shadow-md'>
                        {displayName?.split(/\s+/).length > 1
                          ? `${displayName.split(/\s+/)[0].charAt(0)}${displayName.split(/\s+/)[1].charAt(0)}`
                          : displayName?.charAt(0)}
                      </span>
                    </>
                  )}
                </div>
              )}
              <h1 className='text-2xl font-bold text-white drop-shadow-md m-0 leading-tight'>{displayName}</h1>
              {displaySubtitle
                ? <span className='text-sm text-white/80 drop-shadow-md'>{displaySubtitle}</span>
                : !isContextMode && (
                  <span className='group text-sm flex items-center gap-1 text-white/80 drop-shadow-md'>
                    <Users className='w-4 h-4' />
                    <Link
                      className='text-white/80 underline hover:text-white'
                      to={groupUrl((spaceGroup || group)?.slug || groupSlug, 'members', {})}
                    >
                      {t('{{count}} Members', { count: (spaceGroup || group)?.memberCount || 0 })}
                    </Link>
                    <InviteMembersPopover
                      group={spaceGroup || group}
                      triggerClassName='text-white hover:text-white'
                    />
                  </span>
                  )}
            </div>
          </div>
        </div>
      )}

      {/* Extra room up top so the first row of cards clears the banner edge */}
      <div ref={gridContainerRef} className={cn('w-full max-w-[1000px] mx-auto px-4 pt-10 pb-6', isEditing && 'pb-24')}>
        {/* Space level carries its own takeover headers above; More keeps the bar */}
        {isMoreSpacesLevel && (
          <StickyBackHeader title={nestedTitle} onBack={handleBack} t={t} />
        )}

        {isMoreSpacesLevel
          ? <MoreSpacesGrid group={group} groupSlug={groupSlug} navigate={navigate} t={t} />
          : isEditing
            ? (
              <div className='flex flex-col gap-6'>
                {/* The one-column menu is a grid of cards, so it reorders as cards
                    rather than dropping into the sidebar's list view */}
                <SortableViewsGrid
                  views={groupViews}
                  group={group}
                  targetGroupId={menuGroup?.id}
                  spaceGroup={spaceGroup}
                  onOpenSettings={setSettingsView}
                  onDelete={handleDeleteMenuView}
                />
                {/* One Add slot; its menu explains the view/space distinction */}
                <div className='flex flex-wrap gap-3'>
                  <AddViewOrSpaceMenu
                    canAddSpace={!spaceGroup && canAdminister}
                    onChooseView={() => setShowAddView(true)}
                    onChooseSpace={() => setShowAddSpace(true)}
                  />
                </div>
                {!spaceGroup && (
                  <div className='flex flex-col gap-3 pt-4 border-t border-foreground/10'>
                    <TextSection>{t('More')}</TextSection>
                    <MoreSpacesGrid
                      group={group}
                      groupSlug={groupSlug}
                      navigate={navigate}
                      t={t}
                      isEditing
                      onOpenSettings={setSettingsView}
                      onOpenSpaceSettings={(space) => setSettingsView({ type: 'space', linkedGroup: space, name: space.name, icon: space.icon })}
                    />
                  </div>
                )}
                {showAddView && (
                  <AddGroupViewDialog
                    group={menuGroup}
                    groupViews={groupViews}
                    acceptedPostTypes={menuGroup?.acceptedPostTypes}
                    onClose={() => setShowAddView(false)}
                  />
                )}
                {showAddSpace && <AddSpaceDialog group={group} onClose={() => setShowAddSpace(false)} />}
              </div>
              )
            : (
              <div className='flex flex-col gap-6'>
                {!isContextMode && menuGroup?.id && viewsLoading
                  ? <ViewsGridSkeleton />
                  : (
                    <ViewsGrid
                      sections={sections}
                      groupSlug={groupSlug}
                      group={menuGroup}
                      spaceGroup={spaceGroup}
                      navigate={navigate}
                      t={t}
                    />
                    )}
                {!isContextMode && !isEditing && !isMoreSpacesLevel && canAddMembers && (menuGroup?.openJoinRequestCount || 0) > 0 && (
                  <div className='flex flex-wrap gap-3'>
                    <JoinRequestsCard
                      count={menuGroup.openJoinRequestCount}
                      onClick={() => navigate(groupUrl(menuGroup.slug, 'settings/requests'))}
                      t={t}
                    />
                  </div>
                )}
                {!isContextMode && !spaceGroup && showMoreSpacesCard && (
                  <div className='flex flex-wrap gap-3'>
                    <MoreSpacesCard
                      onClick={() => navigate(groupUrl(groupSlug, 'more-views'))}
                      t={t}
                    />
                  </div>
                )}
              </div>
              )}

        {/* Editing pins Done to the foot of the column, matching More Views and
            Spaces; Edit Menu stays in flow, where it isn't competing for attention */}
        {!isContextMode && canAdminister && !isMoreSpacesLevel && !isEditing && (
          <div className='flex justify-center mt-6'>
            <button
              type='button'
              onClick={toggleEditing}
              className='flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm transition-all border-foreground/20 hover:border-foreground/40 text-foreground/60 hover:text-foreground/80'
            >
              <Pencil className='w-4 h-4' /> {t('Edit Menu')}
            </button>
          </div>
        )}
      </div>

      {!isContextMode && canAdminister && !isMoreSpacesLevel && isEditing && (
        <EditingBottomBar containerRef={gridContainerRef}>
          <button type='button' onClick={toggleEditing} className={EDITING_BAR_BUTTON_CLASS}>
            <X className='w-4 h-4' /> {t('Done Editing')}
          </button>
        </EditingBottomBar>
      )}

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
                group={menuGroup}
                view={settingsView}
                onCancel={() => setSettingsView(null)}
                onCreated={() => setSettingsView(null)}
              />
              )
            : (
              <GroupViewSettingsModal
                view={settingsView}
                group={menuGroup}
                onClose={() => setSettingsView(null)}
              />
              )
      )}
    </div>
  )
}
