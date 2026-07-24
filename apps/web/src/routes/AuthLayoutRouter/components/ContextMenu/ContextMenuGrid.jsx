import { cn, bgImageStyle } from 'util/index'
import { Bell, Settings, Users, Pencil, X, CircleEllipsis, ChevronLeft } from 'lucide-react'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import GroupViewPresenter, {
  displayNameForView,
  getStaticMenuViews,
  MANAGE_ROUND_VIEW
} from '@hylo/presenters/GroupViewPresenter'
import {
  groupUrl,
  currentUserSettingsUrl,
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
import { RESP_ADMINISTRATION, RESP_MANAGE_SPACES, FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS, FETCH_GROUP_VIEWS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import { filterMoreSpacesSections } from 'util/paidSpaceVisibility'
import { mapbox as mapboxConfig } from 'config'
import useAppearance from 'hooks/useAppearance'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import CardIconField from './CardIconField'
import GroupViewIcon from './GroupViewIcon'
import GroupViewEditList from './GroupViewEditList'
import { viewCardColor, inkOn, fieldSeed } from './viewCardTheme'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import { menuViewUrl } from './groupViewMenuUrl'

// Cards are deliberately dark in both themes — each is a mini canvas tinted by
// its view's brand color (see viewCardTheme.js), per the one-column dashboard design.
const CARD_CLASS = 'group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 transition-all w-[calc(50%-6px)] aspect-[13/11] sm:w-[208px] sm:h-[176px] sm:aspect-auto cursor-pointer hover:-translate-y-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
const CARD_DARK_BG = 'hsl(0 0% 14%)'
const cardGradient = (col) => `linear-gradient(150deg, color-mix(in srgb, ${col} 30%, #16171a), color-mix(in srgb, ${col} 17%, #0d0e10))`
const cardHoverRing = (col) => `inset 0 0 0 1px color-mix(in srgb, ${col} 55%, transparent)`

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

/** Full-width text header row in the grid menu. */
function TextSection ({ children }) {
  return (
    <h2 className='text-base font-semibold text-foreground/70 px-1 w-full'>
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
    <div className='flex flex-col gap-6'>
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
  const isMap = presentedView.type === 'map'
  const isSpace = presentedView.type === 'space'
  const isLogout = presentedView.type === 'logout'
  const currentUser = useSelector(getMe)
  const { effectiveColorScheme } = useAppearance()
  const mapStyle = effectiveColorScheme === 'dark' ? 'dark-v11' : 'light-v11'
  const mapCenter = group?.locationObject?.center || currentUser?.locationObject?.center

  const staticMapUrl = isMap && mapboxConfig.token
    ? mapCenter
      ? `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/${mapCenter.lng},${mapCenter.lat},4,0/280x200@2x?access_token=${mapboxConfig.token}`
      : `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/0,20,1,0/280x200@2x?access_token=${mapboxConfig.token}`
    : null

  // Avatar-backed cards (spaces, groups, members) show an image, not a pattern;
  // icon cards get the postType color theme with the icon-field background.
  const linkedGroup = presentedView.linkedGroup
  const bgImageUrl = presentedView.avatarUrl
    ? (linkedGroup?.bannerUrl || presentedView.avatarUrl)
    : null
  const col = viewCardColor(presentedView)
  const tint = `color-mix(in srgb, ${col} 60%, white)`
  const ink = inkOn(col)
  // Map/welcome cards keep their extra content, so their icon+label stay in a
  // flowing column; plain cards center the tile exactly per the design.
  const hasExtraContent = Boolean((isMap && staticMapUrl) || (isWelcome && welcomeText))

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

  const hasUnread = (presentedView.newPostCount || 0) > 0

  const iconTile = (
    <div
      className='w-14 h-14 rounded-[15px] grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
      style={bgImageUrl
        ? { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid hsl(0 0% 100% / 0.28)' }
        : { background: col, color: ink, border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
    >
      <span className='flex items-center justify-center w-[26px] h-[26px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[26px] [&>span]:!leading-none'>
        <GroupViewIcon view={presentedView} className='!w-[26px] !h-[26px] !mr-0' />
      </span>
    </div>
  )

  const label = (
    <h3 className='text-sm font-bold text-white line-clamp-2 m-0 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]'>{title}</h3>
  )

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={CARD_CLASS}
      style={{
        background: bgImageUrl ? CARD_DARK_BG : cardGradient(col),
        boxShadow: hover ? `0 12px 30px rgba(0,0,0,0.45), ${cardHoverRing(col)}` : undefined
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
      {bgImageUrl
        ? (
          <>
            <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
            <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
          </>
          )
        : (
          <CardIconField view={presentedView} tint={tint} w={208} h={176} seed={fieldSeed(view.id)} />
          )}

      {hasUnread && (
        <span className='absolute top-2 right-2 z-10 w-3 h-3 rounded-full bg-orange-500 border-2 border-black/40' />
      )}

      {hasExtraContent
        ? (
          <div className='relative h-full flex flex-col p-2 sm:p-3'>
            <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
              {iconTile}
              {label}
            </div>
            {isMap && staticMapUrl && (
              <div className='mt-auto -mx-2 -mb-2 sm:-mx-3 sm:-mb-3 overflow-hidden'>
                <img
                  src={staticMapUrl}
                  alt={title}
                  className='w-full h-[86px] object-cover'
                />
              </div>
            )}
            {isWelcome && welcomeText && (
              <p className='m-0 px-1 text-xs text-white/70 line-clamp-2 leading-relaxed [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'>{welcomeText}</p>
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

/** Card for a space (or related group) in the More Spaces grid. Image-backed
 * with a frosted-glass tile, matching the design's space cards. */
function EntityCard ({ name, icon, avatarUrl, bannerUrl, onClick, badge }) {
  const bgImageUrl = bannerUrl || avatarUrl
  return (
    <div
      onClick={onClick}
      className={CARD_CLASS}
      style={{ background: CARD_DARK_BG }}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {bgImageUrl && (
        <>
          <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
          <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
        </>
      )}
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div className='w-14 h-14 rounded-[15px] grid place-items-center shrink-0 text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]' style={{ background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', border: '1px solid hsl(0 0% 100% / 0.28)' }}>
            {avatarUrl
              ? <Avatar avatarUrl={avatarUrl} name={name} medium className='!w-10 !h-10' />
              : icon
                ? <LucideIcon name={icon} className='w-7 h-7' />
                : <div className='w-7 h-7 rounded-full bg-white/20' />}
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className='text-sm font-bold text-white line-clamp-2 m-0 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]'>{name}</h3>
          {badge && <span className='text-[10.5px] font-semibold text-white/70 mt-1 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'>{badge}</span>}
        </div>
      </div>
    </div>
  )
}

/** Card opening the More Views and Spaces nested grid. */
function MoreSpacesCard ({ onClick, t }) {
  return (
    <div
      onClick={onClick}
      className={CARD_CLASS}
      style={{ background: CARD_DARK_BG }}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div className='w-14 h-14 rounded-[15px] grid place-items-center text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)]' style={{ background: 'hsl(0 0% 100% / 0.16)', border: '1px solid hsl(0 0% 100% / 0.28)' }}>
            <CircleEllipsis className='w-7 h-7' />
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className='text-sm font-bold text-white m-0 leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]'>{t('More Views and Spaces')}</h3>
        </div>
      </div>
    </div>
  )
}

/** Nested More Views and Spaces grid with section headers. */
function MoreSpacesGrid ({ group, groupSlug, navigate, t }) {
  const dispatch = useDispatch()
  const sectionsRaw = useSelector(state => getMoreViewsSections(state, group))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_MANAGE_SPACES,
    groupId: group?.id
  }))
  const publishedOfferings = usePublishedOfferings(group?.id)
  const sections = useMemo(
    () => filterMoreSpacesSections(sectionsRaw, {
      offerings: publishedOfferings,
      canManageSpaces
    }),
    [sectionsRaw, publishedOfferings, canManageSpaces]
  )
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const childGroups = useSelector(state => getChildGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )
  const hasRelatedGroups = parentGroups.length + childGroups.length + peerGroups.length > 0

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
    dispatch(fetchGroupViews(group.id))
  }, [dispatch, group?.id, groupSlug])

  const handleOpenSpace = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local), { state: { fromMoreViews: true } })
  }, [groupSlug, navigate])

  const handleOpenView = useCallback((view) => {
    const presented = GroupViewPresenter(view)
    const url = menuViewUrl(groupSlug, presented)
    if (url) navigate(url)
  }, [groupSlug, navigate])

  const offMenuViews = useMemo(() => {
    return (sections.offMenuViews || []).filter(view => {
      if (view.type === 'related-groups' && !hasRelatedGroups) return false
      return true
    })
  }, [sections.offMenuViews, hasRelatedGroups])

  const gridSections = useMemo(() => {
    const result = []
    if (offMenuViews.length) {
      result.push({
        title: t('Views'),
        items: offMenuViews.map(view => {
          const presented = GroupViewPresenter(view)
          return {
            key: view.id,
            name: displayNameForView(presented, t),
            icon: presented.icon || presented.type,
            onClick: () => handleOpenView(view)
          }
        })
      })
    }
    if (sections.trackSpaces?.length) {
      result.push({
        title: t('Tracks'),
        items: sections.trackSpaces.map(space => ({
          key: space.id,
          name: space.name,
          avatarUrl: space.avatarUrl,
          bannerUrl: space.bannerUrl,
          icon: space.icon,
          badge: space.isDraft ? t('Draft') : null,
          onClick: () => handleOpenSpace(space)
        }))
      })
    }
    if (sections.fundingRoundSpaces?.length) {
      result.push({
        title: t('Funding Rounds'),
        items: sections.fundingRoundSpaces.map(space => ({
          key: space.id,
          name: space.name,
          avatarUrl: space.avatarUrl,
          bannerUrl: space.bannerUrl,
          icon: space.icon,
          onClick: () => handleOpenSpace(space)
        }))
      })
    }
    if (sections.otherSpaces?.length) {
      result.push({
        title: t('Other Spaces'),
        items: sections.otherSpaces.map(space => ({
          key: space.id,
          name: space.name,
          avatarUrl: space.avatarUrl,
          bannerUrl: space.bannerUrl,
          icon: space.icon,
          onClick: () => handleOpenSpace(space)
        }))
      })
    }
    return result
  }, [sections, offMenuViews, handleOpenSpace, handleOpenView, t])

  if (pending && gridSections.length === 0) {
    return <p className='text-sm text-foreground/40'>{t('Loading…')}</p>
  }

  if (gridSections.length === 0) {
    return <p className='text-sm text-foreground/40'>{t('Nothing here yet')}</p>
  }

  return (
    <div className='flex flex-col gap-6'>
      {gridSections.map(section => (
        <div key={section.title} className='flex flex-col gap-3'>
          <TextSection>{section.title}</TextSection>
          <div className='flex flex-wrap gap-3'>
            {section.items.map(item => {
              const handleClick = item.onClick
              return (
                <EntityCard
                  key={item.key}
                  name={item.name}
                  icon={item.icon}
                  avatarUrl={item.avatarUrl}
                  bannerUrl={item.bannerUrl}
                  badge={item.badge}
                  onClick={handleClick}
                />
              )
            })}
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
  const groupSlug = group?.slug
  const isContextMode = Boolean(context) && !group

  const isMoreSpacesLevel = !isContextMode && !spaceGroup && location.pathname.replace(/\/$/, '').endsWith('/more-views')
  const isSpaceLevel = Boolean(spaceGroup)
  const isNestedLevel = isMoreSpacesLevel || isSpaceLevel

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: (spaceGroup || group)?.id
  }))
  const canManageSpaces = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_MANAGE_SPACES,
    groupId: group?.id
  }))
  const isEditing = !isContextMode && getQuerystringParam('edit', location) === 'true' && canAdminister && !isMoreSpacesLevel
  const [settingsView, setSettingsView] = useState(null)
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)

  // Reset breadcrumb; nested levels use the sticky back bar instead of ViewHeader.
  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({})
  }, [setHeaderDetails, groupSlug, spaceGroup?.id, isMoreSpacesLevel, context])

  const menuGroup = spaceGroup || group

  useEffect(() => {
    if (!isContextMode && menuGroup?.id) dispatch(fetchGroupViews(menuGroup.id))
  }, [dispatch, menuGroup?.id, isContextMode])

  const groupViews = useSelector(state => isContextMode ? [] : getGroupViews(state, menuGroup))
  const viewsPending = useSelector(state => isPendingFor(FETCH_GROUP_VIEWS, state))
  const viewsLoading = viewsPending && groupViews.length === 0

  const visibleViews = useMemo(() => {
    if (isContextMode) {
      const profileUrl = personUrl(currentUser?.id)
      return getStaticMenuViews({
        isPublicContext: context === 'public',
        isMyContext: context === 'my' || context === 'all',
        profileUrl
      }) || []
    }
    const views = (groupViews || [])
      .filter(view => view.order != null)
      .filter(view => viewAcceptedByPostTypes(view.type, menuGroup?.acceptedPostTypes))
    if (spaceGroup?.fundingRound?.id && canManageSpaces) {
      return [...views, MANAGE_ROUND_VIEW]
    }
    return views
  }, [isContextMode, context, currentUser?.id, groupViews, menuGroup?.acceptedPostTypes, spaceGroup?.fundingRound?.id, canManageSpaces])

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
    ? t('More Views and Spaces')
    : (spaceGroup?.name || t('Space'))

  return (
    <div className='ContextMenuGrid w-full h-full overflow-y-auto' id='context-menu-grid'>
      {/* Banner — root group/context menu only */}
      {!isNestedLevel && (
        <div className='relative w-full'>
          <div id='context-menu-grid-banner' className='relative h-[220px] overflow-hidden'>
            <div className='absolute inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
            <div className='absolute inset-0 bg-darkening/50' />

            {!isContextMode && (
              <div className='absolute top-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-[1000px] px-3 flex items-center justify-between'>
                <button type='button' onClick={() => navigate(currentUserSettingsUrl('notifications?group=' + group.id))}>
                  <Bell className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                </button>

                {canAdminister && (
                  <button type='button' onClick={() => navigate(groupUrl(groupSlug, 'settings', {}))}>
                    <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
                  </button>
                )}
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
                  <span className='text-sm flex items-center gap-1 text-white/80 drop-shadow-md'>
                    <Users className='w-4 h-4' />
                    {t('{{count}} Members', { count: (spaceGroup || group)?.memberCount || 0 })}
                  </span>
                  )}
            </div>
          </div>
        </div>
      )}

      <div className='w-full max-w-[1000px] mx-auto px-4 py-6'>
        {isNestedLevel && (
          <StickyBackHeader title={nestedTitle} onBack={handleBack} t={t} />
        )}

        {isMoreSpacesLevel
          ? <MoreSpacesGrid group={group} groupSlug={groupSlug} navigate={navigate} t={t} />
          : isEditing
            ? (
              <div className='flex flex-col gap-3'>
                <GroupViewEditList
                  views={groupViews}
                  group={menuGroup}
                  onSettings={setSettingsView}
                />
                <div className='flex flex-col gap-2 max-w-md'>
                  <AddViewButton onClick={() => setShowAddView(true)} />
                  {!spaceGroup && canManageSpaces && <AddSpaceButton onClick={() => setShowAddSpace(true)} />}
                </div>
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
                  ? <p className='text-sm text-foreground/40'>{t('Loading views…')}</p>
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
                {!isContextMode && !spaceGroup && (
                  <div className='flex flex-wrap gap-3'>
                    <MoreSpacesCard
                      onClick={() => navigate(groupUrl(groupSlug, 'more-views'))}
                      t={t}
                    />
                  </div>
                )}
              </div>
              )}

        {!isContextMode && canAdminister && !isMoreSpacesLevel && (
          <div className='flex justify-center mt-6'>
            <button
              type='button'
              onClick={toggleEditing}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                isEditing
                  ? 'border-selected bg-selected/10 text-selected hover:bg-selected/20'
                  : 'border-foreground/20 hover:border-foreground/40 text-foreground/60 hover:text-foreground/80'
              )}
            >
              {isEditing
                ? <><X className='w-4 h-4' /> {t('Done Editing')}</>
                : <><Pencil className='w-4 h-4' /> {t('Edit Menu')}</>}
            </button>
          </div>
        )}
      </div>

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
