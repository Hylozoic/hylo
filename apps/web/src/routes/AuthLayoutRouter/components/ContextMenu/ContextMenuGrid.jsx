import { cn, bgImageStyle } from 'util/index'
import { isDrawerNavLayout } from 'util/mobile'
import { Info, Settings, Users, Pencil, X, CircleEllipsis, ChevronLeft, Search, ShieldCheck, UserPlus } from 'lucide-react'
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import InviteMembersDialog from 'components/InviteMembersDialog/InviteMembersDialog'
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
import { menuViewUrl, spaceEntryUrl, isParentGroupPath } from './groupViewMenuUrl'
import { WebViewMessageTypes } from '@hylo/shared'
import { sendMessageToWebView } from 'util/webView'
import logout from 'store/actions/logout'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { RESP_ADMINISTRATION, RESP_ADD_MEMBERS, RESP_MANAGE_CONTENT, FETCH_GROUP_SPACES, FETCH_GROUP_VIEWS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import getMyMemberships from 'store/selectors/getMyMemberships'
import { filterMoreSpacesSections, filterSpaceViewsForMenuVisibility, spaceMenuVisibilityOpts } from 'util/spaceVisibility'
import useAppearance from 'hooks/useAppearance'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import useGroupViews from 'hooks/useGroupViews'
import useMoreSpacesSections from 'hooks/useMoreSpacesSections'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import { createGroupView, deleteGroupView, deleteSpace, archiveSpace, setGroupViewHidden, updateGroupView } from 'store/actions/groupViews'
import { canHardDeleteView, isMenuViewVisible } from 'store/models/GroupView'
import GroupMenuHeader from 'components/GroupMenuHeader'
import GroupNotificationsPopover from 'components/GroupNotificationsPopover/GroupNotificationsPopover'
import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import MenuRowBackground from './MenuRowBackground'
import SortableViewsGrid from './SortableViewsGrid'
import GroupViewCard, { SpaceViewCard } from './GroupViewCard'
import ViewsGridSkeleton from './ViewsGridSkeleton'
import {
  viewCardColor,
  inkOn,
  cardGradient,
  cardFieldTint,
  cardHoverRing,
  cardRestRing,
  cardFadeGradient,
  cardChrome,
  cardHoverShadow,
  cardRestShadow,
  CARD_CLASS,
  CARD_FADE_CLASS,
  CARD_TITLE_CLASS,
  CARD_TILE_CLASS,
  CARD_LABEL_TOP_CLASS,
  CARD_W,
  CARD_H
} from './viewCardTheme'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddSpaceCollectionDialog from './AddSpaceCollectionDialog'
import AddGroupViewDialog from './AddGroupViewDialog'
import AddSpaceDialog from './AddSpaceDialog'
import AddViewOrSpaceMenu from './AddViewOrSpaceMenu'
import EditingBottomBar, { EDITING_BAR_BUTTON_CLASS } from './EditingBottomBar'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import { appendSpaceId, spaceCollectionViews } from 'util/spaceCollection'

/** Synthetic views so steward-alert and More Spaces cards share the icon wallpaper of real views. */
const MORE_SPACES_VIEW = { lucideIcon: 'CircleEllipsis' }
const MODERATION_VIEW = { lucideIcon: 'ShieldCheck' }
const JOIN_REQUESTS_VIEW = { lucideIcon: 'UserPlus' }

/**
 * True for views that cannot fit a card cell and must occupy their own row.
 */
function isFullWidthGridView (view) {
  return view?.type === 'text' || view?.type === 'separator'
}

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
    if (isFullWidthGridView(view)) {
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
function SpaceBannerHeader ({ group, spaceGroup, canAdminister, onOpenSettings, t }) {
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
        : <MenuRowBackground view={presentedSpaceView} bannerUrl={null} rows={8} spaced className='rounded-none' />}

      {/* Controls bar, mirroring the group banner: bell left, settings right */}
      <div className='absolute top-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-[1000px] px-3 flex items-center justify-between'>
        <div className={controlClass}>
          <GroupNotificationsPopover group={spaceGroup} className='w-6 h-6 drop-shadow-md hover:scale-110 transition-all' />
        </div>
        <div className='flex items-center gap-2'>
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
            'w-14 h-14 rounded-xl shadow-lg bg-cover bg-center overflow-hidden relative grid place-items-center',
            presentedSpaceView?.avatarUrl
              ? 'border-2 border-white/30'
              // Frosted glass, standardized with the space cards' tile
              : cn(
                'backdrop-blur-sm',
                bannerUrl
                  ? 'bg-white/15 text-white'
                  : 'bg-black/5 text-foreground/80 dark:bg-white/15 dark:text-white'
              )
          )}
        >
          {!presentedSpaceView?.avatarUrl && (
            <GroupViewIcon view={presentedSpaceView} className='!w-7 !h-7 !mr-0' />
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
          <InviteMembersDialog
            group={spaceGroup}
            parentGroup={group}
            alwaysVisible
            triggerLabel={t('Invite')}
            triggerClassName={cn('rounded-full border px-2 py-0.5 hover:scale-100', pillClass)}
          />
          <Link
            to={spaceUrl(group.slug, localSpace, 'about')}
            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 no-underline hover:no-underline transition-colors', pillClass)}
          >
            <Info className='w-3.5 h-3.5' />
            {t('About')}
          </Link>
        </span>
      </div>
    </div>
  )
}

function StickyBackHeader ({ title, icon, onBack, t }) {
  // Dressed as ViewHeader (surface, hairline, shadow, chevron + icon + bold
  // title) — this level hides the real ViewHeader, so the bar stands in for it
  return (
    <div className='sticky top-0 z-30 p-2 bg-context-menu-background border-b border-foreground/[0.08] shadow-[0_4px_14px_0px_rgba(0,0,0,0.16)] dark:border-transparent dark:shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)] flex items-center'>
      <button
        type='button'
        onClick={onBack}
        className='p-2 -ml-1 mr-1 cursor-pointer text-foreground/70 hover:text-foreground transition-colors shrink-0'
        aria-label={t('Back')}
      >
        <ChevronLeft className='w-6 h-6' />
      </button>
      {icon && React.cloneElement(icon, { className: 'w-5 h-5 shrink-0 mr-2' })}
      {title && (
        <h2 className='text-foreground font-bold m-0 truncate min-w-0'>
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
function ViewsGrid ({ sections, group, spaceGroup, onOpen, t, footer = null }) {
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
              <GroupViewCard
                key={view.id}
                view={view}
                group={group}
                spaceGroup={spaceGroup}
                onOpen={onOpen}
              />
            ))}
          </div>
        )
      })}
      {footer}
    </div>
  )
}

/** Card opening the More Spaces nested grid. */
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
            className={cn(CARD_TILE_CLASS, 'grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.35)]')}
            style={{ background: col, color: inkOn(col), border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            <CircleEllipsis className='w-7 h-7' />
          </div>
        </div>
        <div className={cn(CARD_LABEL_TOP_CLASS, 'absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center text-center px-3')}>
          <h3 className={cn(CARD_TITLE_CLASS, isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>{t('More Spaces')}</h3>
        </div>
      </div>
    </div>
  )
}

/** Steward-alert card (moderation / join requests) with a count badge. */
function StewardAlertCard ({ view, icon, title, count, onClick }) {
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
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardIconField view={view} tint={tint} w={CARD_W} h={CARD_H} />
      <div className={CARD_FADE_CLASS} style={{ background: cardFadeGradient(effectiveColorScheme) }} />
      {count > 0 && (
        <span className='absolute top-1.5 right-1.5 z-10 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center border-2 border-background'>
          {count}
        </span>
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className={cn(CARD_TILE_CLASS, 'grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.35)]')}
            style={{ background: col, color: inkOn(col), border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            {icon}
          </div>
        </div>
        <div className={cn(CARD_LABEL_TOP_CLASS, 'absolute left-0 right-0 bottom-0 flex flex-col items-center justify-center text-center px-3')}>
          <h3 className={cn(CARD_TITLE_CLASS, isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>{title}</h3>
        </div>
      </div>
    </div>
  )
}

/**
 * Everything behind More Spaces: the visible sections, whether there is
 * anything there at all, and whether we are still finding out. One hook so the
 * card that links here can't disagree with what this page would render — the
 * track/round/space buckets need spaces to have been fetched, so a caller that
 * hasn't fetched them would think the page was empty.
 */
function useMoreSpacesContent (group) {
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const sectionsRaw = useMoreSpacesSections(group)
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
  const pending = useSelector(state => isPendingFor(FETCH_GROUP_SPACES, state))

  const showDrafts = sections.draftSpaces?.length > 0
  const showTracks = sections.trackSpaces?.length > 0
  const showFundingRounds = sections.fundingRoundSpaces?.length > 0
  const showOtherSpaces = sections.otherSpaces?.length > 0
  const showArchived = sections.archivedSpaces?.length > 0

  return {
    sections,
    canManageSpaces,
    pending,
    showDrafts,
    showTracks,
    showFundingRounds,
    showOtherSpaces,
    showArchived,
    hasContent: showDrafts || showTracks || showFundingRounds || showOtherSpaces || showArchived
  }
}

/** Nested More Spaces grid with section headers. Supports edit mode actions. */
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
    pending,
    showDrafts,
    showTracks,
    showFundingRounds,
    showOtherSpaces,
    showArchived,
    hasContent
  } = useMoreSpacesContent(group)
  const groupViews = useGroupViews(group)
  const [deletingSpaceId, setDeletingSpaceId] = useState(null)

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupViews(group.id))
  }, [dispatch, group?.id, groupSlug])

  const handleOpenSpace = useCallback((space) => {
    if (isEditing) return
    navigate(spaceEntryUrl(groupSlug, space), { state: { fromMoreSpaces: true } })
  }, [groupSlug, navigate, isEditing])

  const handleOpenSpaceAbout = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local, '/about'))
  }, [groupSlug, navigate])

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

  const collectionViews = useMemo(
    () => spaceCollectionViews(groupViews).map(view => ({
      id: view.id,
      name: displayNameForView(view, t),
      settings: view.settings
    })),
    [groupViews, t]
  )

  const handleAddToCollection = useCallback(async (space, collectionView) => {
    if (!group?.id || !space?.id || !collectionView?.id) return
    const fullView = (groupViews || []).find(v => String(v.id) === String(collectionView.id))
    if (!fullView) return
    try {
      await dispatch(updateGroupView({
        id: fullView.id,
        groupId: group.id,
        settings: appendSpaceId(fullView.settings, space.id)
      }))
    } catch (error) {
      console.error('Failed to add space to collection:', error)
    }
  }, [dispatch, group?.id, groupViews])

  const handleDeleteSpace = useCallback(async (space) => {
    if (!space?.id || deletingSpaceId) return
    const confirmed = window.confirm(
      t('Are you sure you want to delete {{name}}? It will be hidden from the menu and More Spaces.', {
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

  const handleArchiveSpace = useCallback(async (space) => {
    if (!space?.id || deletingSpaceId) return
    const confirmed = window.confirm(
      t('Are you sure you want to archive {{name}}?', { name: space.name })
    )
    if (!confirmed) return
    setDeletingSpaceId(space.id)
    try {
      await dispatch(archiveSpace(space.id))
      await dispatch(fetchGroupSpaces(group.id))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to archive space:', error)
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
      {[
        showOtherSpaces && { key: 'other', items: sections.otherSpaces },
        showTracks && { key: 'tracks', title: t('Tracks'), items: sections.trackSpaces },
        showFundingRounds && { key: 'rounds', title: t('Funding Rounds'), items: sections.fundingRoundSpaces },
        showDrafts && { key: 'drafts', title: t('Drafts'), items: sections.draftSpaces },
        showArchived && { key: 'archived', title: t('Archived'), items: sections.archivedSpaces }
      ].filter(Boolean).map(section => (
        <div key={section.key} className='flex flex-col gap-3'>
          {section.title && <TextSection>{section.title}</TextSection>}
          <div className='flex flex-wrap gap-3'>
            {section.items.map(space => (
              <SpaceViewCard
                key={space.id}
                space={space}
                isEditing={isEditing}
                isDeleting={String(deletingSpaceId) === String(space.id)}
                onOpen={handleOpenSpace}
                onOpenAbout={handleOpenSpaceAbout}
                onAddToMenu={space.status === 'archived' || space.status === 'draft' ? null : handleAddSpaceToMenu}
                onAddToCollection={handleAddToCollection}
                collectionViews={collectionViews}
                onOpenSettings={onOpenSpaceSettings}
                onDelete={handleDeleteSpace}
                onArchive={space.status === 'archived' ? null : handleArchiveSpace}
              />
            ))}
          </div>
        </div>
      ))}
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
  const previousLocation = useSelector(getPreviousLocation)
  const groupSlug = group?.slug
  const isContextMode = Boolean(context) && !group

  const isMoreSpacesLevel = !isContextMode && !spaceGroup && location.pathname.replace(/\/$/, '').endsWith('/more-spaces')
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
  const canModerate = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_MANAGE_CONTENT,
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

  // Whether to offer More Spaces at all. MoreSpacesGrid fetches these
  // itself once you are on that level, so only fetch here — where the card lives —
  // to avoid asking twice.
  const moreSpaces = useMoreSpacesContent(group)
  // Wait until spaces have loaded — pending would flash the card then hide it
  // when this group has nothing behind More Spaces.
  const showMoreSpacesCard = moreSpaces.hasContent
  const moderationCount = menuGroup?.openModerationActionCount || 0
  const joinRequestCount = menuGroup?.openJoinRequestCount || 0
  const showStewardAlerts = !isContextMode && !isEditing && !isMoreSpacesLevel &&
    ((canModerate && moderationCount > 0) || (canAddMembers && joinRequestCount > 0))
  useEffect(() => {
    if (isContextMode || isMoreSpacesLevel || spaceGroup || !group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
  }, [dispatch, isContextMode, isMoreSpacesLevel, spaceGroup, group?.id, groupSlug])

  const groupViews = useGroupViews(isContextMode ? null : menuGroup)
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
    if (!window.confirm(t('Are you sure you want to delete {{name}}?', { name: label }))) return
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
      (groupViews || []).filter(view => isMenuViewVisible(view, menuGroup?.acceptedPostTypes)),
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
    if (isSpaceLevel || isMoreSpacesLevel) {
      if (isParentGroupPath(previousLocation?.pathname, groupSlug)) {
        navigate(previousLocation)
        return
      }
      navigate(groupUrl(groupSlug))
      return
    }
    navigate(-1)
  }, [isSpaceLevel, isMoreSpacesLevel, previousLocation, groupSlug, navigate])

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

  /** Open a menu card: logout, space grid, or the view's route. External links are handled by GroupViewCard. */
  const handleOpenMenuView = useCallback(async (view) => {
    const presented = GroupViewPresenter(view)
    if (presented.type === 'logout') {
      await dispatch(logout())
      if (window.HyloMobileV2) {
        sendMessageToWebView(WebViewMessageTypes.LOGOUT)
      } else {
        dispatch(replace('/login', null))
      }
      return
    }
    if (presented.type === 'space' && presented.linkedGroup) {
      navigate(spaceEntryUrl(groupSlug, presented.linkedGroup))
      return
    }
    const url = menuViewUrl(groupSlug, presented, spaceGroup)
    if (url) navigate(url)
  }, [dispatch, groupSlug, navigate, spaceGroup])

  const nestedTitle = isMoreSpacesLevel
    ? t('More Spaces')
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

                {/* Members / invite / about sit under the name, matching GroupMenuHeader.
                    Top-right keeps settings, then search on the far right. */}
                <div className='flex items-center gap-2'>
                  {canAdminister && (
                    <button type='button' onClick={() => navigate(groupUrl(groupSlug, 'settings', {}))}>
                      <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set('groupSlug', groupSlug)
                      params.set('from', `${location.pathname}${location.search || ''}`)
                      navigate(`/search?${params.toString()}`)
                    }}
                    aria-label={t('Search')}
                  >
                    <Search className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                  </button>
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
                  <span className='flex items-center gap-1 text-xs'>
                    <Link
                      className='inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:bg-white/25 hover:text-white no-underline hover:no-underline transition-colors'
                      to={groupUrl((spaceGroup || group)?.slug || groupSlug, 'members', {})}
                      aria-label={t('{{count}} Members', { count: (spaceGroup || group)?.memberCount || 0 })}
                    >
                      <Users className='w-3.5 h-3.5' />
                      {(spaceGroup || group)?.memberCount || 0}
                    </Link>
                    <InviteMembersDialog
                      group={spaceGroup || group}
                      parentGroup={spaceGroup ? group : null}
                      alwaysVisible
                      triggerLabel={t('Invite')}
                      triggerClassName='rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:text-white hover:bg-white/25 hover:scale-100'
                    />
                    <button
                      type='button'
                      onClick={() => navigate(groupUrl((spaceGroup || group)?.slug || groupSlug, 'about', {}))}
                      className='inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:bg-white/25 hover:text-white transition-colors'
                    >
                      <Info className='w-3.5 h-3.5' />
                      {t('About')}
                    </button>
                  </span>
                  )}
            </div>
          </div>
        </div>
      )}

      {/* More Spaces has no banner — keep the back bar flush with the top */}
      {isMoreSpacesLevel && (
        <StickyBackHeader title={nestedTitle} icon={<CircleEllipsis />} onBack={handleBack} t={t} />
      )}

      {/* Extra room up top so the first row of cards clears the banner edge */}
      <div ref={gridContainerRef} className={cn('w-full max-w-[1000px] mx-auto px-4 pb-6', isMoreSpacesLevel ? 'pt-4' : 'pt-10', isEditing && 'pb-24')}>
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
                    <TextSection>{t('More Spaces')}</TextSection>
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
                      group={menuGroup}
                      spaceGroup={spaceGroup}
                      onOpen={handleOpenMenuView}
                      t={t}
                      footer={showStewardAlerts
                        ? (
                          <div className='flex flex-wrap gap-3'>
                            {canModerate && moderationCount > 0 && (
                              <StewardAlertCard
                                view={MODERATION_VIEW}
                                icon={<ShieldCheck className='w-7 h-7' />}
                                title={t('Moderation')}
                                count={moderationCount}
                                onClick={() => navigate(
                                  spaceGroup
                                    ? spaceUrl(groupSlug, localSpaceSlug(groupSlug, spaceGroup.slug), 'about/moderation')
                                    : groupUrl(groupSlug, 'about/moderation')
                                )}
                              />
                            )}
                            {canAddMembers && joinRequestCount > 0 && (
                              <StewardAlertCard
                                view={JOIN_REQUESTS_VIEW}
                                icon={<UserPlus className='w-7 h-7' />}
                                title={t('Join Requests')}
                                count={joinRequestCount}
                                onClick={() => navigate(
                                  spaceGroup
                                    ? spaceUrl(groupSlug, localSpaceSlug(groupSlug, spaceGroup.slug), 'requests')
                                    : groupUrl(groupSlug, 'requests')
                                )}
                              />
                            )}
                          </div>
                          )
                        : null}
                    />
                    )}
                {!isContextMode && !spaceGroup && showMoreSpacesCard && (
                  <div className='flex flex-wrap gap-3'>
                    <MoreSpacesCard
                      onClick={() => navigate(groupUrl(groupSlug, 'more-spaces'))}
                      t={t}
                    />
                  </div>
                )}
              </div>
              )}

        {/* Editing pins Done to the foot of the column, matching More Spaces;
            Edit Menu stays in flow, where it isn't competing for attention */}
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
              parentGroup={group}
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
            : settingsView.type === 'space-collection'
              ? (
                <AddSpaceCollectionDialog
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
