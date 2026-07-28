import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import { useViewHeader } from 'contexts/ViewHeaderContext'
import { addQuerystringToPath, groupUrl, localSpaceSlug, spaceHomeUrl } from '@hylo/navigation'
import fetchGroupRelationships from 'store/actions/fetchGroupRelationships'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView, deleteGroupView, setGroupViewHidden } from 'store/actions/groupViews'
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
import { canHardDeleteView } from 'store/models/GroupView'
import { cn } from 'util/index'

import AddGroupViewDialog, { AddViewButton } from './AddGroupViewDialog'
import AddSpaceDialog, { AddSpaceButton } from './AddSpaceDialog'
import GroupViewSettingsModal from './GroupViewSettingsModal'
import SpaceSettingsModal from './SpaceSettingsModal'
import GroupViewCard, { SpaceViewCard } from './GroupViewCard'
import { menuViewUrl } from './groupViewMenuUrl'

/** Section heading above a card grid. */
function SectionHeading ({ children }) {
  return (
    <h2 className='text-base font-semibold text-foreground/70 px-1 w-full mt-6 mb-3 first:mt-0'>
      {children}
    </h2>
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
    const views = (sections.offMenuViews || []).filter(view => {
      if (view.type === 'related-groups' && !hasRelatedGroups) return false
      return true
    })
    return [...views].sort((a, b) =>
      displayNameForView(GroupViewPresenter(a), t).localeCompare(
        displayNameForView(GroupViewPresenter(b), t)
      )
    )
  }, [sections.offMenuViews, hasRelatedGroups, t])

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

  const handleDeleteView = useCallback(async (view) => {
    if (!canHardDeleteView(view) || !contentGroup?.id) return
    const label = displayNameForView(GroupViewPresenter(view), t)
    if (!window.confirm(t('Are you sure you want to permanently delete {{name}}?', { name: label }))) return
    try {
      await dispatch(deleteGroupView(view.id, contentGroup.id))
      await dispatch(fetchGroupViews(contentGroup.id))
    } catch (error) {
      console.error('Failed to delete view:', error)
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
                        <GroupViewCard
                          key={view.id}
                          view={view}
                          isEditing={isEditing}
                          onAddToMenu={handleAddViewToMenu}
                          onOpen={handleOpenView}
                          onOpenSettings={setSettingsView}
                          onDelete={canHardDeleteView(view) ? handleDeleteView : null}
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
                        <SpaceViewCard
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
                        <SpaceViewCard
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
                        <SpaceViewCard
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
          addToMenu={false}
        />
      )}
      {showAddSpace && (
        <AddSpaceDialog group={contentGroup} onClose={handleAddSpaceClose} addToMenu={false} />
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
