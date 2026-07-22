import { ChevronRight, CircleEllipsis, Info, Plus, Settings } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import GroupViewIcon from './GroupViewIcon'
import MenuLink from './MenuLink'
import SpaceSettingsModal from './SpaceSettingsModal'
import { groupUrl, localSpaceSlug, spaceGroupViewUrl, spaceHomeUrl, spaceUrl } from '@hylo/navigation'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView } from 'store/actions/groupViews'
import { FETCH_GROUP_RELATIONSHIPS, FETCH_GROUP_SPACES } from 'store/constants'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import { getMoreSpacesSections } from 'store/selectors/getMoreSpacesSections'
import getMyMemberships from 'store/selectors/getMyMemberships'
import isPendingFor from 'store/selectors/isPendingFor'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_MANAGE_SPACES } from 'store/constants'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import { cn } from 'util/index'
import { filterMoreSpacesSections } from 'util/paidSpaceVisibility'

/** Matches ContextMenu GroupViewMenuItem row chrome. */
const MENU_ITEM_CLASS = 'flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 mb-[.3rem] w-full transition-all scale-100 hover:scale-102 opacity-85 hover:opacity-100'

/** MenuLink overrides when nested inside a styled space row wrapper. */
const MENU_ITEM_INNER_LINK_CLASS = 'flex-1 flex items-center gap-2 min-w-0 border-0 bg-transparent p-0 mb-0 rounded-none shadow-none hover:border-0 hover:bg-transparent hover:scale-100 font-inherit'

/** Sub-section header inside the More Spaces expand. */
function SubSectionHeading ({ children }) {
  return (
    <p className='text-xs text-foreground/40 px-2 mt-3 mb-1 uppercase tracking-wide'>
      {children}
    </p>
  )
}

/** Right-side explainer text for a More Spaces row. */
function Explainer ({ children }) {
  if (!children) return null
  return <span className='text-xs text-foreground/40 shrink-0 ml-1'>{children}</span>
}

/** Shared row chrome for related groups in More Spaces. */
function RelatedGroupRow ({ to, icon, name, explainer, isEditing, onAddToMenu }) {
  const { t } = useTranslation()

  return (
    <li className='list-none'>
      <div className={cn(MENU_ITEM_CLASS, 'group')}>
        <MenuLink to={to} className={MENU_ITEM_INNER_LINK_CLASS}>
          {icon}
          <span className='truncate flex-1'>{name}</span>
          <Explainer>{explainer}</Explainer>
        </MenuLink>
        {isEditing && onAddToMenu && (
          <button
            type='button'
            className='p-1 text-foreground/50 hover:text-foreground rounded opacity-0 group-hover:opacity-100 shrink-0'
            onClick={onAddToMenu}
            aria-label={t('Add to Menu')}
            title={t('Add to Menu')}
          >
            <Plus className='w-4 h-4' />
          </button>
        )}
      </div>
    </li>
  )
}

/** Icon for a space row — avatar, lucide icon, or placeholder. */
function SpaceIcon ({ space }) {
  if (space.avatarUrl) {
    return <Avatar avatarUrl={space.avatarUrl} name={space.name} small />
  }
  if (space.icon) {
    return <LucideIcon name={space.icon} className='h-4 w-4 shrink-0' />
  }
  return <div className='h-4 w-4 shrink-0 rounded-full bg-foreground/15' />
}

/** Nested view link under an expanded More Spaces space. */
function SpaceViewRow ({ view, parentSlug, spaceGroup }) {
  const { t } = useTranslation()
  const presentedView = useMemo(() => GroupViewPresenter(view), [view])
  const url = spaceGroupViewUrl(parentSlug, spaceGroup, presentedView) || spaceHomeUrl(parentSlug, spaceGroup)

  if (presentedView.type === 'separator') {
    return <hr className='border-foreground/10 my-1' />
  }

  if (presentedView.type === 'text') {
    return (
      <li className='list-none'>
        <p className='text-xs text-foreground/40 px-2 mt-2 mb-1 uppercase tracking-wide'>
          {displayNameForView(presentedView, t)}
        </p>
      </li>
    )
  }

  return (
    <li className='list-none'>
      <MenuLink to={url} className={MENU_ITEM_CLASS}>
        <GroupViewIcon view={presentedView} />
        <span className='truncate flex-1'>{displayNameForView(presentedView, t)}</span>
      </MenuLink>
    </li>
  )
}

/**
 * Space row that navigates to the space home and expands nested views,
 * matching the main ContextMenu space behavior.
 * Non-members still navigate (SpaceJoinPage) but do not expand nested views.
 */
function MoreSpaceRow ({
  space,
  parentSlug,
  spaceSlug,
  explainer,
  isEditing,
  isSpaceMember,
  onAddToMenu,
  onSettings,
  independentSpaceMenu = false
}) {
  const { t } = useTranslation()
  const spaceViews = useMemo(
    () => [...(space.groupViews?.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [space.groupViews]
  )
  const hasMultipleViews = spaceViews.length > 1
  const isSpaceActive = Boolean(
    spaceSlug &&
    localSpaceSlug(parentSlug, space.slug) === spaceSlug
  )
  // Nested expand only when independent space menu is off and the space route is active.
  const isExpanded = !independentSpaceMenu && isSpaceMember && isSpaceActive && hasMultipleViews
  const spaceHome = spaceHomeUrl(parentSlug, space)
  const aboutUrl = spaceUrl(parentSlug, localSpaceSlug(parentSlug, space.slug), '/about')

  return (
    <li className='list-none'>
      <div
        className={cn(
          MENU_ITEM_CLASS,
          'group',
          isSpaceActive && 'opacity-100 border-selected bg-card font-bold'
        )}
      >
        <MenuLink
          to={spaceHome}
          isActive={false}
          className={MENU_ITEM_INNER_LINK_CLASS}
        >
          <SpaceIcon space={space} />
          <span className='truncate flex-1'>{space.name}</span>
          <Explainer>{explainer}</Explainer>
        </MenuLink>
        {isEditing && (
          <div className='flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100'>
            {onAddToMenu && (
              <button
                type='button'
                className='p-1 text-foreground/50 hover:text-foreground rounded'
                onClick={onAddToMenu}
                aria-label={t('Add to Menu')}
                title={t('Add to Menu')}
              >
                <Plus className='w-4 h-4' />
              </button>
            )}
            {onSettings && (
              <button
                type='button'
                className='p-1 text-foreground/50 hover:text-foreground rounded'
                onClick={onSettings}
                aria-label={t('Settings')}
                title={t('Settings')}
              >
                <Settings className='w-4 h-4' />
              </button>
            )}
          </div>
        )}
        {!isEditing && (
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
          {spaceViews.map(view => (
            <SpaceViewRow
              key={view.id}
              view={view}
              parentSlug={parentSlug}
              spaceGroup={space}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Renders a list of expandable space rows for one More Spaces sub-section. */
function SpaceSubSection ({
  title,
  spaces,
  parentSlug,
  spaceSlug,
  isEditing,
  myMemberships,
  getExplainer,
  onAddToMenu,
  onSettings,
  independentSpaceMenu = false
}) {
  if (!spaces?.length) return null

  return (
    <li className='list-none'>
      <SubSectionHeading>{title}</SubSectionHeading>
      <ul className='m-0 p-0'>
        {spaces.map(space => (
          <MoreSpaceRow
            key={space.id}
            space={space}
            parentSlug={parentSlug}
            spaceSlug={spaceSlug}
            explainer={getExplainer?.(space)}
            isEditing={isEditing}
            isSpaceMember={myMemberships.some(m => m.group.id === space.id)}
            onAddToMenu={onAddToMenu ? () => onAddToMenu(space) : null}
            onSettings={onSettings ? () => onSettings(space) : null}
            independentSpaceMenu={independentSpaceMenu}
          />
        ))}
      </ul>
    </li>
  )
}

/**
 * Expandable More Spaces section for the ContextMenu footer.
 * Prefetches spaces/relationships on mount and hides when nothing is off-menu.
 */
export default function MoreSpacesSection ({
  group,
  groupSlug,
  spaceSlug,
  isEditing,
  independentSpaceMenu = false
}) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [settingsSpace, setSettingsSpace] = useState(null)

  const sectionsRaw = useSelector(state => getMoreSpacesSections(state, group))
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
  const myMemberships = useSelector(getMyMemberships)
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )

  const relatedGroups = [
    ...parentGroups.map(g => ({ group: g, relationLabel: t('Parent') })),
    ...childGroups.map(g => ({ group: g, relationLabel: t('Child') })),
    ...peerGroups.map(g => ({ group: g, relationLabel: t('Peer') }))
  ]
    .filter(({ group: related }) => {
      // Hide related groups already linked as type='group' menu views
      const menuGroupIds = new Set(
        (group?.groupViews?.items || [])
          .filter(view => view.type === 'group' && view.linkedGroup?.id)
          .map(view => String(view.linkedGroup.id))
      )
      return !menuGroupIds.has(String(related.id))
    })
    .sort((a, b) => (a.group.name || '').localeCompare(b.group.name || ''))

  // Reset load state when switching groups so we don't flash stale emptiness.
  useEffect(() => {
    setHasLoaded(false)
    setExpanded(false)
  }, [group?.id])

  // Prefetch so we can hide More Spaces when there is nothing off-menu.
  useEffect(() => {
    if (hasLoaded || !group?.id || !groupSlug) return
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
    setHasLoaded(true)
  }, [hasLoaded, group?.id, groupSlug, dispatch])

  // Auto-expand More Spaces when viewing an off-menu space (members only).
  // Skip when independent space menu replaces the whole ContextMenu for that space.
  useEffect(() => {
    if (independentSpaceMenu || !spaceSlug || !hasLoaded) return
    const allSpaces = [
      ...sections.trackSpaces,
      ...sections.fundingRoundSpaces,
      ...sections.otherSpaces,
      ...sections.archivedSpaces
    ]
    const match = allSpaces.find(space =>
      localSpaceSlug(groupSlug, space.slug) === spaceSlug
    )
    if (match && myMemberships.some(m => m.group.id === match.id)) {
      setExpanded(true)
    }
  }, [independentSpaceMenu, spaceSlug, hasLoaded, sections, groupSlug, myMemberships])

  const handleToggle = useCallback(() => {
    setExpanded(v => !v)
  }, [])

  const handleAddSpaceToMenu = useCallback(async (space) => {
    if (!group?.id || !space?.id) return
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        type: 'space',
        linkedGroupId: space.id,
        addToEnd: true
      }))
      await dispatch(fetchGroupViews(group.id))
      await dispatch(fetchGroupSpaces(group.id))
    } catch (error) {
      console.error('Failed to add space to menu:', error)
    }
  }, [dispatch, group?.id])

  const handleAddRelatedGroupToMenu = useCallback(async (relatedGroup) => {
    if (!group?.id || !relatedGroup?.id) return
    try {
      await dispatch(createGroupView({
        groupId: group.id,
        type: 'group',
        linkedGroupId: relatedGroup.id,
        addToEnd: true
      }))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to add related group to menu:', error)
    }
  }, [dispatch, group?.id])

  const showTracks = sections.trackSpaces.length > 0
  const showFundingRounds = sections.fundingRoundSpaces.length > 0
  const showRelatedGroups = relatedGroups.length > 0
  const showArchived = sections.archivedSpaces.length > 0
  const showOtherSpaces = sections.otherSpaces.length > 0
  const hasContent = showTracks || showFundingRounds || showRelatedGroups || showArchived || showOtherSpaces

  // Hide until we know there is something off-menu (spaces or related groups).
  if (!hasContent) return null

  return (
    <div className='px-3 pb-2 border-t border-foreground/10 pt-2'>
      <button
        type='button'
        onClick={handleToggle}
        className='flex items-center gap-2 text-base text-foreground border-2 border-transparent hover:border-foreground/50 hover:bg-card rounded-md p-1 pl-2 w-full transition-all opacity-85 hover:opacity-100 text-left'
        aria-expanded={expanded}
      >
        <CircleEllipsis className='w-4 h-4 shrink-0' />
        <span className='flex-1 truncate'>{t('More Spaces')}</span>
        <ChevronRight className={cn('w-4 h-4 shrink-0 text-foreground/50 transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className='mt-1 pl-1'>
          {pending
            ? (
              <p className='text-xs text-foreground/40 px-2 py-2'>{t('Loading…')}</p>
              )
            : (
              <ul className='m-0 p-0'>
                {showTracks && (
                  <SpaceSubSection
                    title={t('Tracks')}
                    spaces={sections.trackSpaces}
                    parentSlug={groupSlug}
                    spaceSlug={spaceSlug}
                    isEditing={isEditing}
                    myMemberships={myMemberships}
                    getExplainer={space => (space.isDraft ? t('Draft') : null)}
                    onAddToMenu={handleAddSpaceToMenu}
                    onSettings={setSettingsSpace}
                    independentSpaceMenu={independentSpaceMenu}
                  />
                )}

                {showFundingRounds && (
                  <SpaceSubSection
                    title={t('Funding Rounds')}
                    spaces={sections.fundingRoundSpaces}
                    parentSlug={groupSlug}
                    spaceSlug={spaceSlug}
                    isEditing={isEditing}
                    myMemberships={myMemberships}
                    onAddToMenu={handleAddSpaceToMenu}
                    onSettings={setSettingsSpace}
                    independentSpaceMenu={independentSpaceMenu}
                  />
                )}

                {showRelatedGroups && (
                  <li className='list-none'>
                    <SubSectionHeading>{t('Related Groups')}</SubSectionHeading>
                    <ul className='m-0 p-0'>
                      {relatedGroups.map(({ group: related, relationLabel }) => (
                        <RelatedGroupRow
                          key={`${relationLabel}-${related.id}`}
                          to={groupUrl(related.slug)}
                          icon={<Avatar avatarUrl={related.avatarUrl} name={related.name} small />}
                          name={related.name}
                          explainer={relationLabel}
                          isEditing={isEditing}
                          onAddToMenu={() => handleAddRelatedGroupToMenu(related)}
                        />
                      ))}
                    </ul>
                  </li>
                )}

                {showOtherSpaces && (
                  <SpaceSubSection
                    title={t('Spaces')}
                    spaces={sections.otherSpaces}
                    parentSlug={groupSlug}
                    spaceSlug={spaceSlug}
                    isEditing={isEditing}
                    myMemberships={myMemberships}
                    onAddToMenu={handleAddSpaceToMenu}
                    onSettings={setSettingsSpace}
                    independentSpaceMenu={independentSpaceMenu}
                  />
                )}

                {showArchived && (
                  <SpaceSubSection
                    title={t('Archived Spaces')}
                    spaces={sections.archivedSpaces}
                    parentSlug={groupSlug}
                    spaceSlug={spaceSlug}
                    isEditing={isEditing}
                    myMemberships={myMemberships}
                    onSettings={setSettingsSpace}
                    independentSpaceMenu={independentSpaceMenu}
                  />
                )}
              </ul>
              )}
        </div>
      )}

      {settingsSpace && (
        <SpaceSettingsModal
          space={settingsSpace}
          group={group}
          onClose={() => setSettingsSpace(null)}
        />
      )}
    </div>
  )
}
