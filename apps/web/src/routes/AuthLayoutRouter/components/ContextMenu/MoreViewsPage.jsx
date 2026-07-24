import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import Avatar from 'components/Avatar'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { addQuerystringToPath, groupUrl, localSpaceSlug, spaceHomeUrl } from '@hylo/navigation'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView, setGroupViewHidden } from 'store/actions/groupViews'
import { FETCH_GROUP_RELATIONSHIPS, FETCH_GROUP_SPACES } from 'store/constants'
import { getGroupViews } from 'store/selectors/getGroupViews'
import { getMoreViewsSections } from 'store/selectors/getMoreSpacesSections'
import {
  getChildGroups,
  getParentGroups,
  getPeerGroups
} from 'store/selectors/getGroupRelationships'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import isPendingFor from 'store/selectors/isPendingFor'
import { deleteGroup } from 'routes/GroupSettings/GroupSettings.store'
import { DEFAULT_BANNER } from 'store/models/Group'
import { bgImageStyle, cn } from 'util/index'

import useAppearance from 'hooks/useAppearance'
import CardIconField from './CardIconField'
import { viewCardColor, inkOn, fieldSeed, cardGradient, cardFieldTint, cardHoverRing, cardRestRing, cardNeutralBg } from './viewCardTheme'
import GroupViewIcon from './GroupViewIcon'
import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import { menuViewUrl } from './groupViewMenuUrl'

// Same postType-themed card treatment as the one-column dashboard (ContextMenuGrid).
const CARD_CLASS = 'group relative flex flex-col overflow-hidden rounded-2xl border transition-all w-[calc(50%-6px)] aspect-[13/11] sm:w-[208px] sm:h-[176px] sm:aspect-auto cursor-pointer hover:-translate-y-0.5'
/** Scheme-dependent card border + resting shadow. */
const cardChrome = (isDark) => isDark
  ? 'border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
  : 'border-black/10 shadow-[0_2px_8px_rgba(0,0,0,0.12)]'
const cardHoverShadow = (isDark) => isDark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 12px 30px rgba(0,0,0,0.18)'
// Rest shadow mirrors cardChrome's class values so inline hover shadows transition smoothly
const cardRestShadow = (isDark) => isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.12)'

const CARD_ACTION_BTN = 'p-1.5 rounded-md bg-background/90 text-foreground/60 hover:text-foreground pointer-events-auto'

/** Section heading above a card grid. */
function SectionHeading ({ children }) {
  return (
    <h2 className='text-base font-semibold text-foreground/70 px-1 w-full mt-6 mb-3 first:mt-0'>
      {children}
    </h2>
  )
}

/** Edit-mode action row at the bottom of a card: +, gear, delete. */
function CardEditActions ({ onAddToMenu, onOpenSettings, onDelete, addLabel, settingsLabel, deleteLabel }) {
  return (
    <div className='absolute bottom-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none'>
      {onAddToMenu && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onAddToMenu()
          }}
          className={CARD_ACTION_BTN}
          aria-label={addLabel}
          title={addLabel}
        >
          <Plus className='w-4 h-4' />
        </button>
      )}
      {onOpenSettings && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onOpenSettings()
          }}
          className={CARD_ACTION_BTN}
          aria-label={settingsLabel}
          title={settingsLabel}
        >
          <Settings className='w-4 h-4' />
        </button>
      )}
      {onDelete && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(CARD_ACTION_BTN, 'hover:text-destructive')}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <Trash2 className='w-4 h-4' />
        </button>
      )}
    </div>
  )
}

/** Card for an off-menu GroupView, themed by its postType color. */
function ViewCard ({ view, isEditing, onAddToMenu, onOpen, onOpenSettings }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const [hover, setHover] = useState(false)
  const presented = useMemo(() => GroupViewPresenter(view), [view])
  const title = displayNameForView(presented, t)
  const col = viewCardColor(presented)
  const tint = cardFieldTint(col, effectiveColorScheme)
  const ink = inkOn(col)

  const handleOpen = () => {
    if (isEditing) return
    onOpen(view)
  }

  return (
    <div
      className={cn(CARD_CLASS, cardChrome(isDark), isEditing && 'cursor-default')}
      style={{
        background: cardGradient(col, effectiveColorScheme),
        // Light mode: icon cards take their border from the view color (same as the
        // icon tile) — softened at rest, full strength on hover (hex-alpha animates)
        ...(!isDark ? { borderColor: hover && !isEditing ? col : `${col}59` } : {}),
        // Always set both shadows in matching structure so the transition interpolates
        boxShadow: hover && !isEditing
          ? `${cardHoverShadow(isDark)}, ${cardHoverRing(col)}`
          : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={isEditing ? undefined : 'button'}
      tabIndex={isEditing ? undefined : 0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (isEditing) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(view)
        }
      }}
    >
      <CardIconField view={presented} tint={tint} w={208} h={176} seed={fieldSeed(view.id)} />
      <div className='relative h-full'>
        <div className='absolute inset-0 grid place-items-center'>
          <div
            className='w-14 h-14 rounded-[15px] grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
            style={{ background: col, color: ink, border: `1px solid color-mix(in srgb, ${col} 55%, white)` }}
          >
            <span className='flex items-center justify-center w-[26px] h-[26px] [&>svg]:!w-full [&>svg]:!h-full [&>img]:!w-full [&>img]:!h-full [&>span]:!text-[26px] [&>span]:!leading-none'>
              <GroupViewIcon view={presented} className='!w-[26px] !h-[26px] !mr-0' />
            </span>
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn('text-sm font-bold line-clamp-2 m-0 leading-tight', isDark ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground')}>{title}</h3>
        </div>
      </div>
      {isEditing && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(view) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(view) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
        />
      )}
    </div>
  )
}

/** Card for an off-menu space: banner image + scrim with a frosted-glass tile. */
function SpaceCard ({ space, isEditing, onOpen, onAddToMenu, onOpenSettings, onDelete }) {
  const { t } = useTranslation()
  const { effectiveColorScheme } = useAppearance()
  const isDark = effectiveColorScheme === 'dark'
  const bgImageUrl = (space.bannerUrl && space.bannerUrl !== DEFAULT_BANNER ? space.bannerUrl : null) || space.avatarUrl || null
  const onLightSurface = !isDark && !bgImageUrl

  return (
    <div
      className={cn(CARD_CLASS, cardChrome(isDark))}
      style={{ background: cardNeutralBg(effectiveColorScheme) }}
      role='button'
      tabIndex={0}
      onClick={() => onOpen(space)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(space)
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
          <div
            className={cn('w-14 h-14 rounded-[15px] grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]', onLightSurface ? 'text-foreground/80' : 'text-white')}
            style={onLightSurface
              ? { background: 'hsl(0 0% 0% / 0.06)', border: '1px solid hsl(0 0% 0% / 0.15)' }
              : { background: 'hsl(0 0% 100% / 0.16)', backdropFilter: 'blur(4px)', border: '1px solid hsl(0 0% 100% / 0.28)' }}
          >
            {space.avatarUrl
              ? <Avatar avatarUrl={space.avatarUrl} name={space.name} medium className='!w-10 !h-10' />
              : space.icon
                ? <LucideIcon name={space.icon} className='w-7 h-7' />
                : <div className={cn('w-7 h-7 rounded-full', onLightSurface ? 'bg-black/15' : 'bg-white/20')} />}
          </div>
        </div>
        <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-3'>
          <h3 className={cn('text-sm font-bold line-clamp-2 m-0 leading-tight', onLightSurface ? 'text-foreground' : 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]')}>{space.name}</h3>
          {space.isDraft && (
            <span className={cn('text-[10.5px] font-semibold mt-1', onLightSurface ? 'text-foreground/60' : 'text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]')}>{t('Draft')}</span>
          )}
        </div>
      </div>
      {isEditing && (
        <CardEditActions
          onAddToMenu={onAddToMenu ? () => onAddToMenu(space) : null}
          onOpenSettings={onOpenSettings ? () => onOpenSettings(space) : null}
          onDelete={onDelete ? () => onDelete(space) : null}
          addLabel={t('Add to Menu')}
          settingsLabel={t('Settings')}
          deleteLabel={t('Delete Space')}
        />
      )}
    </div>
  )
}

/**
 * More Views and Spaces — center-column grid of off-menu views and spaces.
 * With ?edit=true, shows Edit Menu chrome (help, add buttons, welcome toggles, + / trash).
 */
export default function MoreViewsPage ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { setHeaderDetails } = useViewHeader()
  const groupSlug = group?.slug
  const isEditing = getQuerystringParam('edit', location) === 'true'
  const spaceSlugParam = getQuerystringParam('space', location)

  // Resolve optional space drill-in (?space=) so center column shows that space's more-views.
  const spaceFromList = useMemo(() => {
    if (!spaceSlugParam || !groupSlug) return null
    const fromViews = (group?.groupViews?.items || []).find(view =>
      view.type === 'space' &&
      view.linkedGroup &&
      localSpaceSlug(groupSlug, view.linkedGroup.slug) === spaceSlugParam
    )
    if (fromViews?.linkedGroup) return fromViews.linkedGroup
    return (group?.spaces?.items || []).find(space =>
      localSpaceSlug(groupSlug, space.slug) === spaceSlugParam
    ) || null
  }, [spaceSlugParam, groupSlug, group?.groupViews?.items, group?.spaces?.items])

  const spaceGroupFromStore = useSelector(state =>
    spaceFromList?.slug ? getGroupForSlug(state, spaceFromList.slug) : null
  )
  const contentGroup = spaceGroupFromStore || spaceFromList || group
  const isSpaceMoreViews = Boolean(spaceSlugParam && contentGroup && contentGroup.id !== group?.id)

  const groupViews = useSelector(state => getGroupViews(state, contentGroup))
  const sections = useSelector(state => getMoreViewsSections(state, contentGroup))
  const parentGroups = useSelector(state => getParentGroups(state, contentGroup))
  const childGroups = useSelector(state => getChildGroups(state, contentGroup))
  const peerGroups = useSelector(state => getPeerGroups(state, contentGroup))
  const pending = useSelector(state =>
    isPendingFor([FETCH_GROUP_SPACES, FETCH_GROUP_RELATIONSHIPS], state)
  )

  const hasRelatedGroups = parentGroups.length + childGroups.length + peerGroups.length > 0

  const offMenuViews = useMemo(() => {
    return (sections.offMenuViews || []).filter(view => {
      if (view.type === 'related-groups' && !hasRelatedGroups) return false
      return true
    })
  }, [sections.offMenuViews, hasRelatedGroups])

  const [showAddView, setShowAddView] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)
  const [settingsView, setSettingsView] = useState(null)
  const [settingsSpace, setSettingsSpace] = useState(null)
  const settingsTypeParam = getQuerystringParam('settings', location)

  useEffect(() => {
    setHeaderDetails({
      title: isEditing ? t('More Views and Spaces (Editing)') : t('More Views and Spaces'),
      icon: '',
      info: '',
      search: false
    })
  }, [setHeaderDetails, t, isEditing])

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupViews(group.id))
    dispatch(fetchGroupSpaces(group.id))
    dispatch(fetchGroupRelationships(groupSlug))
  }, [dispatch, group?.id, groupSlug])

  useEffect(() => {
    if (!isSpaceMoreViews || !contentGroup?.id) return
    dispatch(fetchGroupViews(contentGroup.id))
    if (contentGroup.slug) dispatch(fetchGroupSpaces(contentGroup.id))
  }, [dispatch, isSpaceMoreViews, contentGroup?.id, contentGroup?.slug])

  // Open welcome (or other) settings when arriving with ?settings=<type>
  useEffect(() => {
    if (!settingsTypeParam || !groupViews?.length) return
    const match = groupViews.find(v => v.type === settingsTypeParam)
    if (match) setSettingsView(match)
  }, [settingsTypeParam, groupViews])

  const handleAddViewToMenu = useCallback(async (view) => {
    if (!contentGroup?.id || !view?.id) return
    try {
      await dispatch(setGroupViewHidden({
        id: view.id,
        groupId: contentGroup.id,
        hidden: false
      }))
      await dispatch(fetchGroupViews(contentGroup.id))
    } catch (error) {
      console.error('Failed to add view to menu:', error)
    }
  }, [dispatch, contentGroup?.id])

  const handleAddSpaceToMenu = useCallback(async (space) => {
    if (!contentGroup?.id || !space?.id) return
    try {
      const existing = (groupViews || []).find(v =>
        v.type === 'space' && String(v.linkedGroup?.id) === String(space.id)
      )
      if (existing?.id) {
        await dispatch(setGroupViewHidden({
          id: existing.id,
          groupId: contentGroup.id,
          hidden: false
        }))
      } else {
        await dispatch(createGroupView({
          groupId: contentGroup.id,
          type: 'space',
          linkedGroupId: space.id,
          addToEnd: true
        }))
      }
      await dispatch(fetchGroupViews(contentGroup.id))
      await dispatch(fetchGroupSpaces(contentGroup.id))
    } catch (error) {
      console.error('Failed to add space to menu:', error)
    }
  }, [dispatch, contentGroup?.id, groupViews])

  const handleDeleteSpace = useCallback(async (space) => {
    if (!space?.id) return
    const confirmed = window.confirm(
      t('Are you sure you want to permanently delete {{name}}? Posts in this space will no longer be accessible.', {
        name: space.name
      })
    )
    if (!confirmed) return
    try {
      await dispatch(deleteGroup(space.id))
      await dispatch(fetchGroupSpaces(contentGroup.id))
      await dispatch(fetchGroupViews(contentGroup.id))
    } catch (error) {
      console.error('Failed to delete space:', error)
    }
  }, [dispatch, contentGroup?.id, t])

  /** Open a view (works in edit mode too — leaves edit and navigates to the view). */
  const handleOpenView = useCallback((view) => {
    const presented = GroupViewPresenter(view)
    const url = menuViewUrl(
      groupSlug,
      presented,
      isSpaceMoreViews ? contentGroup : null
    )
    if (url) navigate(url)
  }, [navigate, groupSlug, isSpaceMoreViews, contentGroup])

  /** Open space home, or in edit mode open that space's more-views still editing. */
  const handleOpenSpace = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    if (isEditing) {
      navigate(addQuerystringToPath(groupUrl(groupSlug, 'more-views'), {
        edit: 'true',
        space: local
      }))
      return
    }
    navigate(spaceHomeUrl(groupSlug, space), { state: { fromMoreViews: true } })
  }, [navigate, groupSlug, isEditing])

  const handleDoneEditing = useCallback(() => {
    navigate(groupUrl(groupSlug))
  }, [navigate, groupSlug])

  // The Done Editing bar is fixed to the viewport bottom; measure the content
  // column so the fixed bar aligns with it instead of the full viewport.
  const containerRef = useRef(null)
  const [barRect, setBarRect] = useState(null)
  useEffect(() => {
    if (!isEditing) return
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setBarRect({ left: rect.left, width: rect.width })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isEditing])

  const handleAddViewClose = useCallback(async () => {
    setShowAddView(false)
    if (contentGroup?.id) await dispatch(fetchGroupViews(contentGroup.id))
  }, [dispatch, contentGroup?.id])

  const handleAddSpaceClose = useCallback(async () => {
    setShowAddSpace(false)
    if (contentGroup?.id) {
      await dispatch(fetchGroupViews(contentGroup.id))
      await dispatch(fetchGroupSpaces(contentGroup.id))
    }
  }, [dispatch, contentGroup?.id])

  const handleCloseSettings = useCallback(async () => {
    setSettingsView(null)
    setSettingsSpace(null)
    if (settingsTypeParam) {
      navigate(addQuerystringToPath(groupUrl(groupSlug, 'more-views'), {
        edit: 'true',
        ...(spaceSlugParam ? { space: spaceSlugParam } : {})
      }), { replace: true })
    }
    if (contentGroup?.id) await dispatch(fetchGroupViews(contentGroup.id))
    if (group?.id) await dispatch(fetchGroupSpaces(group.id))
  }, [dispatch, contentGroup?.id, group?.id, groupSlug, navigate, settingsTypeParam, spaceSlugParam])

  const showViews = offMenuViews.length > 0
  const showTracks = sections.trackSpaces.length > 0
  const showFundingRounds = sections.fundingRoundSpaces.length > 0
  const showOtherSpaces = sections.otherSpaces.length > 0
  const hasContent = showViews || showTracks || showFundingRounds || showOtherSpaces

  return (
    <div ref={containerRef} className={cn('w-full max-w-[980px] mx-auto px-4 py-6', isEditing && 'pb-24')}>
      {isEditing && (
        <>
          <p className='text-sm text-foreground/70 mb-6'>
            {t('Drag and drop items in the menu on the left to reorder them. The top item is the home view for this group.')}
          </p>
          <div className='flex flex-row gap-2 mb-8'>
            <AddViewButton onClick={() => setShowAddView(true)} className='w-auto flex-1 mb-0' />
            {!isSpaceMoreViews && <AddSpaceButton onClick={() => setShowAddSpace(true)} className='w-auto flex-1 mb-0' />}
          </div>
        </>
      )}

      {pending && !hasContent
        ? <p className='text-sm text-foreground/40'>{t('Loading…')}</p>
        : !hasContent
            ? <p className='text-sm text-foreground/40'>{t('No more views or spaces')}</p>
            : (
              <div className='flex flex-col'>
                {showViews && (
                  <section>
                    <SectionHeading>{t('Views')}</SectionHeading>
                    <div className='flex flex-wrap gap-3'>
                      {offMenuViews.map(view => (
                        <ViewCard
                          key={view.id}
                          view={view}
                          isEditing={isEditing}
                          onAddToMenu={handleAddViewToMenu}
                          onOpen={handleOpenView}
                          onOpenSettings={setSettingsView}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {showTracks && (
                  <section>
                    <SectionHeading>{t('Tracks')}</SectionHeading>
                    <div className='flex flex-wrap gap-3'>
                      {sections.trackSpaces.map(space => (
                        <SpaceCard
                          key={space.id}
                          space={space}
                          isEditing={isEditing}
                          onOpen={handleOpenSpace}
                          onAddToMenu={handleAddSpaceToMenu}
                          onOpenSettings={setSettingsSpace}
                          onDelete={handleDeleteSpace}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {showFundingRounds && (
                  <section>
                    <SectionHeading>{t('Funding Rounds')}</SectionHeading>
                    <div className='flex flex-wrap gap-3'>
                      {sections.fundingRoundSpaces.map(space => (
                        <SpaceCard
                          key={space.id}
                          space={space}
                          isEditing={isEditing}
                          onOpen={handleOpenSpace}
                          onAddToMenu={handleAddSpaceToMenu}
                          onOpenSettings={setSettingsSpace}
                          onDelete={handleDeleteSpace}
                        />
                      ))}
                    </div>
                  </section>
                )}
                {showOtherSpaces && (
                  <section>
                    <SectionHeading>{t('Other Spaces')}</SectionHeading>
                    <div className='flex flex-wrap gap-3'>
                      {sections.otherSpaces.map(space => (
                        <SpaceCard
                          key={space.id}
                          space={space}
                          isEditing={isEditing}
                          onOpen={handleOpenSpace}
                          onAddToMenu={handleAddSpaceToMenu}
                          onOpenSettings={setSettingsSpace}
                          onDelete={handleDeleteSpace}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
              )}

      {isEditing && (
        <div
          className='fixed bottom-0 z-30 pt-6 pb-2 px-4 bg-gradient-to-t from-background from-40% to-transparent pointer-events-none'
          style={barRect ? { left: barRect.left, width: barRect.width } : { left: 0, right: 0 }}
        >
          <button
            type='button'
            onClick={handleDoneEditing}
            className='pointer-events-auto flex items-center justify-center gap-2 w-full text-base font-medium text-foreground border-2 border-foreground/30 hover:border-foreground/50 hover:bg-card rounded-md px-3 py-2.5 transition-all'
          >
            <Pencil className='w-4 h-4' />
            <span>{t('Done Editing')}</span>
          </button>
        </div>
      )}

      {showAddView && (
        <AddGroupViewDialog
          group={contentGroup}
          groupViews={groupViews}
          acceptedPostTypes={contentGroup?.acceptedPostTypes}
          onClose={handleAddViewClose}
        />
      )}
      {showAddSpace && (
        <AddSpaceDialog group={contentGroup} onClose={handleAddSpaceClose} />
      )}
      {settingsView && (
        <GroupViewSettingsModal
          view={settingsView}
          group={contentGroup}
          onClose={handleCloseSettings}
        />
      )}
      {settingsSpace && (
        <SpaceSettingsModal
          space={settingsSpace}
          group={group}
          onClose={handleCloseSettings}
        />
      )}
    </div>
  )
}
