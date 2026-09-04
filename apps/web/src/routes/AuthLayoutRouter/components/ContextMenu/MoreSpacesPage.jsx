import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { CircleEllipsis, X } from 'lucide-react'

import { useViewHeader } from 'contexts/ViewHeaderContext'
import { addQuerystringToPath, groupUrl, localSpaceSlug, spaceUrl } from '@hylo/navigation'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { createGroupView, deleteSpace, archiveSpace, setGroupViewHidden, updateGroupView } from 'store/actions/groupViews'
import { FETCH_GROUP_SPACES } from 'store/constants'
import useGroupViews from 'hooks/useGroupViews'
import useMoreSpacesSections from 'hooks/useMoreSpacesSections'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import isPendingFor from 'store/selectors/isPendingFor'
import { cn } from 'util/index'

import AddSpaceDialog from './AddSpaceDialog'
import SpaceSettingsModal from './SpaceSettingsModal'
import { AddCard, SpaceViewCard } from './GroupViewCard'
import EditingBottomBar, { EDITING_BAR_BUTTON_CLASS } from './EditingBottomBar'
import ViewsGridSkeleton from './ViewsGridSkeleton'
import { spaceEntryUrl } from './groupViewMenuUrl'
import { appendSpaceId, spaceCollectionViews } from 'util/spaceCollection'
import { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

/** Section heading above a card grid. Sections own the space above them (see SECTION_CLASS). */
function SectionHeading ({ children }) {
  return (
    <h2 className='text-base font-semibold text-foreground/70 px-1 w-full mb-3'>
      {children}
    </h2>
  )
}

// Space above a section is twice the heading-to-cards gap below it. This lives on
// the section rather than the heading because the heading is always the first child
// of its own section, so `first:` there matched every heading and zeroed them all.
const SECTION_CLASS = 'mt-6 first:mt-0'

/**
 * More Spaces — center-column grid of off-menu spaces (tracks, funding rounds, other).
 * With ?edit=true, shows Edit Menu chrome (add space, welcome toggles, + / trash).
 */
export default function MoreSpacesPage ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { setHeaderDetails } = useViewHeader()
  const groupSlug = group?.slug
  const isEditing = getQuerystringParam('edit', location) === 'true'
  const spaceSlugParam = getQuerystringParam('space', location)

  // Resolve optional space drill-in (?space=) so center column shows that space's more-spaces.
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
  const isSpaceMoreSpaces = Boolean(spaceSlugParam && contentGroup && contentGroup.id !== group?.id)

  const groupViews = useGroupViews(contentGroup)
  const sections = useMoreSpacesSections(contentGroup)
  const pending = useSelector(state => isPendingFor(FETCH_GROUP_SPACES, state))

  const [showAddSpace, setShowAddSpace] = useState(false)
  const [settingsSpace, setSettingsSpace] = useState(null)
  const [deletingSpaceId, setDeletingSpaceId] = useState(null)

  useEffect(() => {
    setHeaderDetails({
      // Editing state as a pill beside the title rather than baked into it,
      // and the same icon the menu row carries — without one this header
      // rendered shorter than every other view's.
      title: isEditing
        ? (
          <span className='flex items-center gap-2'>
            {t('More Spaces')}
            {/* Slim enough to sit inside the title's line box — a taller pill overflows
                the header's fixed height and clips instead of growing it */}
            <span className='text-xs font-semibold rounded-full border border-foreground/20 bg-foreground/10 text-foreground/70 px-2 py-px leading-none self-center'>
              {t('Editing')}
            </span>
          </span>
          )
        : t('More Spaces'),
      icon: <CircleEllipsis />,
      info: '',
      search: true
    })
  }, [setHeaderDetails, t, isEditing])

  useEffect(() => {
    if (!group?.id || !groupSlug) return
    dispatch(fetchGroupViews(group.id))
    dispatch(fetchGroupSpaces(group.id))
  }, [dispatch, group?.id, groupSlug])

  useEffect(() => {
    if (!isSpaceMoreSpaces || !contentGroup?.id) return
    dispatch(fetchGroupViews(contentGroup.id))
    if (contentGroup.slug) dispatch(fetchGroupSpaces(contentGroup.id))
  }, [dispatch, isSpaceMoreSpaces, contentGroup?.id, contentGroup?.slug])

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

  const collectionViews = useMemo(
    () => spaceCollectionViews(groupViews).map(view => ({
      id: view.id,
      name: displayNameForView(view, t),
      settings: view.settings
    })),
    [groupViews, t]
  )

  const handleAddToCollection = useCallback(async (space, collectionView) => {
    if (!contentGroup?.id || !space?.id || !collectionView?.id) return
    const fullView = (groupViews || []).find(v => String(v.id) === String(collectionView.id))
    if (!fullView) return
    try {
      await dispatch(updateGroupView({
        id: fullView.id,
        groupId: contentGroup.id,
        settings: appendSpaceId(fullView.settings, space.id)
      }))
    } catch (error) {
      console.error('Failed to add space to collection:', error)
    }
  }, [dispatch, contentGroup?.id, groupViews])

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
      await dispatch(fetchGroupSpaces(contentGroup.id))
      await dispatch(fetchGroupViews(contentGroup.id))
    } catch (error) {
      console.error('Failed to delete space:', error)
    } finally {
      setDeletingSpaceId(null)
    }
  }, [dispatch, contentGroup?.id, deletingSpaceId, t])

  const handleArchiveSpace = useCallback(async (space) => {
    if (!space?.id || deletingSpaceId) return
    const confirmed = window.confirm(
      t('Are you sure you want to archive {{name}}?', { name: space.name })
    )
    if (!confirmed) return
    setDeletingSpaceId(space.id)
    try {
      await dispatch(archiveSpace(space.id))
      await dispatch(fetchGroupSpaces(contentGroup.id))
      await dispatch(fetchGroupViews(contentGroup.id))
    } catch (error) {
      console.error('Failed to archive space:', error)
    } finally {
      setDeletingSpaceId(null)
    }
  }, [dispatch, contentGroup?.id, deletingSpaceId, t])

  /** Open space home, or in edit mode open that space's home with its menu editing. */
  const handleOpenSpace = useCallback((space) => {
    if (isEditing) {
      navigate(addQuerystringToPath(spaceEntryUrl(groupSlug, space), { edit: 'true' }))
      return
    }
    // Where a menu is visible alongside the content, going straight to the space's
    // home view costs nothing. On a drawer layout SpaceContent shows the space's
    // own menu at the index, so don't skip ahead to home.
    navigate(spaceEntryUrl(groupSlug, space), { state: { fromMoreSpaces: true } })
  }, [navigate, groupSlug, isEditing])

  const handleOpenSpaceAbout = useCallback((space) => {
    const local = localSpaceSlug(groupSlug, space.slug)
    navigate(spaceUrl(groupSlug, local, '/about'))
  }, [groupSlug, navigate])

  const handleDoneEditing = useCallback(() => {
    navigate(groupUrl(groupSlug))
  }, [navigate, groupSlug])

  // EditingBottomBar measures this to size itself
  const containerRef = useRef(null)
  const handleAddSpaceClose = useCallback(async () => {
    setShowAddSpace(false)
    if (contentGroup?.id) {
      await dispatch(fetchGroupViews(contentGroup.id))
      await dispatch(fetchGroupSpaces(contentGroup.id))
    }
  }, [dispatch, contentGroup?.id])

  const handleCloseSettings = useCallback(async () => {
    setSettingsSpace(null)
    if (contentGroup?.id) await dispatch(fetchGroupViews(contentGroup.id))
    if (group?.id) await dispatch(fetchGroupSpaces(group.id))
  }, [dispatch, contentGroup?.id, group?.id])

  const showDrafts = sections.draftSpaces.length > 0
  const showTracks = sections.trackSpaces.length > 0
  const showFundingRounds = sections.fundingRoundSpaces.length > 0
  const showOtherSpaces = sections.otherSpaces.length > 0
  const showArchived = sections.archivedSpaces.length > 0
  const hasContent = showDrafts || showTracks || showFundingRounds || showOtherSpaces || showArchived

  return (
    <div ref={containerRef} className={cn('w-full max-w-[980px] mx-auto px-4 py-6', isEditing && 'pb-24')}>
      {pending && !hasContent
        ? <ViewsGridSkeleton />
        : !hasContent
            ? <p className='text-sm text-foreground/40'>{t('No more spaces')}</p>
            : (
              <div className='flex flex-col'>
                {[
                  showOtherSpaces && { key: 'other', items: sections.otherSpaces },
                  showTracks && { key: 'tracks', title: t('Tracks'), items: sections.trackSpaces },
                  showFundingRounds && { key: 'rounds', title: t('Funding Rounds'), items: sections.fundingRoundSpaces },
                  showDrafts && { key: 'drafts', title: t('Drafts'), items: sections.draftSpaces },
                  showArchived && { key: 'archived', title: t('Archived'), items: sections.archivedSpaces }
                ].filter(Boolean).map(section => (
                  <section key={section.key} className={SECTION_CLASS}>
                    {section.title && <SectionHeading>{section.title}</SectionHeading>}
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
                          onOpenSettings={setSettingsSpace}
                          onDelete={handleDeleteSpace}
                          onArchive={space.status === 'archived' ? null : handleArchiveSpace}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              )}

      {/* Below the sections, and shown even when empty so there is a way to add the first one */}
      {isEditing && !isSpaceMoreSpaces && (
        <div className='flex flex-wrap gap-3 mt-6'>
          <AddCard
            label={t('Add to More Spaces')}
            onClick={() => setShowAddSpace(true)}
          />
        </div>
      )}

      {isEditing && (
        <EditingBottomBar containerRef={containerRef}>
          {/* No reorder hint here — the menu edit tour covers that now */}
          <div className='w-full max-w-[980px] flex items-center justify-end'>
            <button
              type='button'
              onClick={handleDoneEditing}
              className={cn(EDITING_BAR_BUTTON_CLASS, 'shrink-0')}
            >
              <X className='w-4 h-4' />
              <span>{t('Done Editing')}</span>
            </button>
          </div>
        </EditingBottomBar>
      )}

      {showAddSpace && (
        <AddSpaceDialog group={contentGroup} onClose={handleAddSpaceClose} addToMenu={false} />
      )}
      {settingsSpace && (
        <SpaceSettingsModal
          space={settingsSpace}
          parentGroup={group}
          onClose={handleCloseSettings}
        />
      )}
    </div>
  )
}
