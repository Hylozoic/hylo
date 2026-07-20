import { cn, bgImageStyle } from 'util/index'
import { Bell, Settings, Users, Pencil, X, CircleEllipsis, ChevronLeft } from 'lucide-react'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import {
  groupUrl,
  currentUserSettingsUrl,
  addQuerystringToPath,
  localSpaceSlug,
  spaceUrl
} from '@hylo/navigation'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { getMoreSpacesSections } from 'store/selectors/getMoreSpacesSections'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import { RESP_ADMINISTRATION, RESP_MANAGE_SPACES, FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import getMe from 'store/selectors/getMe'
import isPendingFor from 'store/selectors/isPendingFor'
import { mapbox as mapboxConfig } from 'config'
import { useTheme } from 'contexts/ThemeContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import GroupViewIcon from './GroupViewIcon'
import GroupViewEditList from './GroupViewEditList'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import AddCollectionDialog from './AddCollectionDialog'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import { menuViewUrl } from './groupViewMenuUrl'

const CARD_CLASS = 'group relative flex flex-col rounded-xl border-2 border-foreground/10 bg-card/50 transition-all p-2 w-[calc(50%-6px)] aspect-[16/9] sm:p-3 sm:w-[230px] sm:h-[129px] sm:aspect-auto cursor-pointer hover:border-foreground/30 hover:shadow-md'

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
  const currentUser = useSelector(getMe)
  const { effectiveColorScheme } = useTheme()
  const mapStyle = effectiveColorScheme === 'dark' ? 'dark-v11' : 'light-v11'
  const mapCenter = group?.locationObject?.center || currentUser?.locationObject?.center

  const staticMapUrl = isMap && mapboxConfig.token
    ? mapCenter
      ? `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/${mapCenter.lng},${mapCenter.lat},4,0/280x200@2x?access_token=${mapboxConfig.token}`
      : `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/0,20,1,0/280x200@2x?access_token=${mapboxConfig.token}`
    : null

  const handleClick = () => {
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

  return (
    <div
      onClick={handleClick}
      className={CARD_CLASS}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {hasUnread && (
        <span className='absolute -top-1.5 -right-1.5 z-10 w-3 h-3 rounded-full bg-orange-500 border-2 border-background' />
      )}

      <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
        <span className='text-foreground/60 flex items-center justify-center w-[32px] h-[32px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[32px] [&>span]:!leading-none'>
          <GroupViewIcon view={presentedView} className='!w-8 !h-8 !mr-0' />
        </span>
        <h3 className='text-base font-semibold text-foreground line-clamp-2'>{title}</h3>
      </div>

      {isMap && staticMapUrl && (
        <div className='mt-auto -mx-2 -mb-2 rounded-b-lg overflow-hidden'>
          <img
            src={staticMapUrl}
            alt={title}
            className='w-full h-[120px] object-cover'
          />
        </div>
      )}

      {isWelcome && welcomeText && (
        <div className='mt-auto px-1'>
          <p className='text-xs text-foreground/60 line-clamp-5 leading-relaxed'>{welcomeText}</p>
          <button
            type='button'
            onClick={handleClick}
            className='text-xs text-selected hover:text-selected/80 transition-colors mt-1'
          >
            {t('Read more...')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Card for a space (or related group) in the More Spaces grid. */
function EntityCard ({ name, icon, avatarUrl, onClick, badge }) {
  return (
    <div
      onClick={onClick}
      className={CARD_CLASS}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
        {avatarUrl
          ? <Avatar avatarUrl={avatarUrl} name={name} medium className='!w-10 !h-10' />
          : icon
            ? <LucideIcon name={icon} className='w-8 h-8 text-foreground/60' />
            : <div className='w-8 h-8 rounded-full bg-foreground/15' />}
        <h3 className='text-base font-semibold text-foreground line-clamp-2'>{name}</h3>
        {badge && <span className='text-xs text-foreground/40'>{badge}</span>}
      </div>
    </div>
  )
}

/** Card opening the More Spaces nested grid. */
function MoreSpacesCard ({ onClick, t }) {
  return (
    <div
      onClick={onClick}
      className={CARD_CLASS}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
        <CircleEllipsis className='w-8 h-8 text-foreground/60' />
        <h3 className='text-base font-semibold text-foreground'>{t('More Spaces')}</h3>
      </div>
    </div>
  )
}

/** Nested More Spaces grid with section headers. */
function MoreSpacesGrid ({ group, groupSlug, navigate, t }) {
  const dispatch = useDispatch()
  const sections = useSelector(state => getMoreSpacesSections(state, group))
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const childGroups = useSelector(state => getChildGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
  }, [dispatch, group?.id, groupSlug])

  const relatedGroups = useMemo(() => {
    const menuGroupIds = new Set(
      (group?.groupViews?.items || [])
        .filter(view => view.type === 'group' && view.linkedGroup?.id)
        .map(view => String(view.linkedGroup.id))
    )
    return [
      ...parentGroups.map(g => ({ group: g, relationLabel: t('Parent') })),
      ...childGroups.map(g => ({ group: g, relationLabel: t('Child') })),
      ...peerGroups.map(g => ({ group: g, relationLabel: t('Peer') }))
    ]
      .filter(({ group: related }) => !menuGroupIds.has(String(related.id)))
      .sort((a, b) => (a.group.name || '').localeCompare(b.group.name || ''))
  }, [parentGroups, childGroups, peerGroups, group?.groupViews?.items, t])

  const handleOpenSpace = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local), { state: { fromMoreSpaces: true } })
  }, [groupSlug, navigate])

  const gridSections = useMemo(() => {
    const result = []
    if (sections.trackSpaces.length) {
      result.push({ title: t('Tracks'), items: sections.trackSpaces.map(space => ({
        key: space.id,
        name: space.name,
        avatarUrl: space.avatarUrl,
        icon: space.icon,
        badge: space.isDraft ? t('Draft') : null,
        onClick: () => handleOpenSpace(space)
      })) })
    }
    if (sections.fundingRoundSpaces.length) {
      result.push({ title: t('Funding Rounds'), items: sections.fundingRoundSpaces.map(space => ({
        key: space.id,
        name: space.name,
        avatarUrl: space.avatarUrl,
        icon: space.icon,
        onClick: () => handleOpenSpace(space)
      })) })
    }
    if (relatedGroups.length) {
      result.push({ title: t('Related Groups'), items: relatedGroups.map(({ group: related, relationLabel }) => ({
        key: related.id,
        name: related.name,
        avatarUrl: related.avatarUrl,
        badge: relationLabel,
        onClick: () => navigate(groupUrl(related.slug))
      })) })
    }
    if (sections.otherSpaces.length) {
      result.push({ title: t('Spaces'), items: sections.otherSpaces.map(space => ({
        key: space.id,
        name: space.name,
        avatarUrl: space.avatarUrl,
        icon: space.icon,
        onClick: () => handleOpenSpace(space)
      })) })
    }
    if (sections.archivedSpaces.length) {
      result.push({ title: t('Archived Spaces'), items: sections.archivedSpaces.map(space => ({
        key: space.id,
        name: space.name,
        avatarUrl: space.avatarUrl,
        icon: space.icon,
        onClick: () => handleOpenSpace(space)
      })) })
    }
    return result
  }, [sections, relatedGroups, handleOpenSpace, navigate, t])

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
            {section.items.map(item => (
              <EntityCard
                key={item.key}
                name={item.name}
                icon={item.icon}
                avatarUrl={item.avatarUrl}
                badge={item.badge}
                onClick={item.onClick}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Full-screen grid context menu for one-column (simple) groups.
 * Supports nested levels: group menu → more spaces / space menu → view.
 *
 * @param {object} group - Parent group
 * @param {object} [spaceGroup] - When set, renders that space's views (space menu level)
 */
export default function ContextMenuGrid ({ group, spaceGroup = null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const groupSlug = group?.slug

  const isMoreSpacesLevel = !spaceGroup && location.pathname.replace(/\/$/, '').endsWith('/more-spaces')
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
  const isEditing = getQuerystringParam('edit', location) === 'true' && canAdminister && !isMoreSpacesLevel
  const [settingsView, setSettingsView] = useState(null)
  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)

  // Reset breadcrumb; nested levels use the sticky back bar instead of ViewHeader.
  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({})
  }, [setHeaderDetails, groupSlug, spaceGroup?.id, isMoreSpacesLevel])

  const menuGroup = spaceGroup || group

  useEffect(() => {
    if (menuGroup?.id) dispatch(fetchGroupViews(menuGroup.id))
  }, [dispatch, menuGroup?.id])

  const groupViews = useSelector(state => getGroupViews(state, menuGroup))

  const visibleViews = useMemo(() => {
    return (groupViews || [])
      .filter(view => view.order != null)
      .filter(view => viewAcceptedByPostTypes(view.type, menuGroup?.acceptedPostTypes))
  }, [groupViews, menuGroup?.acceptedPostTypes])

  const sections = useMemo(() => partitionViewsIntoSections(visibleViews), [visibleViews])

  const bannerUrl = (spaceGroup || group)?.bannerUrl || group?.bannerUrl || DEFAULT_BANNER
  const avatarUrl = (spaceGroup || group)?.avatarUrl || DEFAULT_AVATAR
  const isDefaultAvatar = avatarUrl === DEFAULT_AVATAR
  const displayName = spaceGroup?.name || group?.name

  const handleBack = useCallback(() => {
    if (isSpaceLevel && location.state?.fromMoreSpaces) {
      navigate(groupUrl(groupSlug, 'more-spaces'))
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
    ? t('More Spaces')
    : (spaceGroup?.name || t('Space'))

  return (
    <div className='ContextMenuGrid w-full h-full overflow-y-auto' id='context-menu-grid'>
      {/* Group/space banner — only on the root group menu */}
      {!isNestedLevel && (
        <div className='relative w-full'>
          <div id='context-menu-grid-banner' className='relative h-[220px] overflow-hidden'>
            <div className='absolute inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
            <div className='absolute inset-0 bg-darkening/50' />

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

            <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-1'>
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
              <h1 className='text-2xl font-bold text-white drop-shadow-md m-0 leading-tight'>{displayName}</h1>
              <span className='text-sm flex items-center gap-1 text-white/80 drop-shadow-md'>
                <Users className='w-4 h-4' />
                {t('{{count}} Members', { count: (spaceGroup || group)?.memberCount || 0 })}
              </span>
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
                {menuGroup?.id && groupViews.length === 0
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
                {!spaceGroup && (
                  <div className='flex flex-wrap gap-3'>
                    <MoreSpacesCard
                      onClick={() => navigate(groupUrl(groupSlug, 'more-spaces'))}
                      t={t}
                    />
                  </div>
                )}
              </div>
              )}

        {canAdminister && !isMoreSpacesLevel && (
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
