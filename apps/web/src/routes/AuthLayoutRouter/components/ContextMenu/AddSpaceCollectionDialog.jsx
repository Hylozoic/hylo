import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { House } from 'lucide-react'

import Button from 'components/ui/button'
import { Input } from 'components/ui/input'
import LucideIconPicker from 'components/LucideIconPicker/LucideIconPicker'
import SpaceSelector from 'components/SpaceSelector'
import {
  createGroupView,
  setHomeView,
  updateGroupView
} from 'store/actions/groupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchForGroup from 'store/actions/fetchForGroup'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { RESP_ADMINISTRATION } from 'store/constants'
import {
  filterSpacesForMenuVisibility,
  spaceMenuVisibilityOpts
} from 'util/spaceVisibility'
import {
  resolveSpacesByIds,
  spaceIdsFromSettings,
  withSpaceIds
} from 'util/spaceCollection'
import usePublishedOfferings from 'hooks/usePublishedOfferings'
import AddSpaceDialog from './AddSpaceDialog'

/** Resolves the group that owns a view (top-level menu or nested space menu). */
function findViewOwnerGroup (parentGroup, viewId) {
  const items = parentGroup?.groupViews?.items || []
  if (items.some(v => String(v.id) === String(viewId))) return parentGroup
  for (const menuView of items) {
    const spaceGroup = menuView.linkedGroup
    if (spaceGroup?.groupViews?.items?.some(v => String(v.id) === String(viewId))) {
      return spaceGroup
    }
  }
  return parentGroup
}

/** Modal for creating or editing a space-collection GroupView. */
export default function AddSpaceCollectionDialog ({ group, view, onCancel, onCreated, onAdd }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const isEditing = Boolean(view?.id)
  const [name, setName] = useState(view?.name || '')
  const [icon, setIcon] = useState(view?.icon || 'Boxes')
  const [spaces, setSpaces] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [showAddSpace, setShowAddSpace] = useState(false)

  const ownerGroup = useMemo(
    () => (isEditing ? findViewOwnerGroup(group, view.id) : group),
    [group, isEditing, view?.id]
  )

  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const publishedOfferings = usePublishedOfferings(ownerGroup?.id)
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, {
    responsibility: RESP_ADMINISTRATION,
    groupId: ownerGroup?.id
  }))

  const visibleSpaces = useMemo(() => {
    const allSpaces = ownerGroup?.spaces?.items || []
    return filterSpacesForMenuVisibility(allSpaces, spaceMenuVisibilityOpts({
      offerings: publishedOfferings,
      canManageSpaces: canAdminister,
      memberships: myMemberships,
      currentUser,
      parentGroupId: ownerGroup?.id
    })).map(space => ({
      ...space,
      isDraft: Boolean(space.track && !space.track.publishedAt)
    }))
  }, [ownerGroup?.spaces?.items, ownerGroup?.id, publishedOfferings, canAdminister, myMemberships, currentUser])

  useEffect(() => {
    if (ownerGroup?.id) dispatch(fetchGroupSpaces(ownerGroup.id))
  }, [dispatch, ownerGroup?.id])

  useEffect(() => {
    setName(view?.name || '')
    setIcon(view?.icon || 'Boxes')
    if (!isEditing) {
      setSpaces([])
      return
    }
    const ids = spaceIdsFromSettings(view?.settings)
    const allSpaces = ownerGroup?.spaces?.items || []
    setSpaces(resolveSpacesByIds(allSpaces, ids))
  }, [isEditing, view?.id, view?.name, view?.icon, view?.settings, ownerGroup?.spaces?.items])

  const canSave = name.trim().length >= 2

  const handleSelectSpace = useCallback((space) => {
    setSpaces(prev => {
      if (prev.some(s => String(s.id) === String(space.id))) return prev
      return [...prev, space]
    })
  }, [])

  const handleRemoveSpace = useCallback((space) => {
    setSpaces(prev => prev.filter(s => String(s.id) !== String(space.id)))
  }, [])

  const handleReorderSpace = useCallback((space, newIndex) => {
    setSpaces(prev => {
      const fromIndex = prev.findIndex(s => String(s.id) === String(space.id))
      if (fromIndex === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(newIndex, 0, moved)
      return next
    })
  }, [])

  /** Persist create or update for the space-collection view. */
  const handleSave = useCallback(async () => {
    if (!canSave) return

    const spaceIds = spaces.map(s => s.id)
    const viewData = {
      type: 'space-collection',
      name: name.trim(),
      icon,
      settings: withSpaceIds(view?.settings, spaceIds),
      addToEnd: true
    }

    if (onAdd && !isEditing) {
      onAdd(viewData)
      return
    }

    if (!group?.id) return
    setIsSaving(true)
    try {
      if (isEditing) {
        await dispatch(updateGroupView({
          id: view.id,
          groupId: group.id,
          name: viewData.name,
          icon,
          settings: viewData.settings
        }))
      } else {
        await dispatch(createGroupView({
          groupId: group.id,
          type: 'space-collection',
          name: viewData.name,
          icon,
          settings: viewData.settings,
          addToEnd: true
        }))
      }
      onCreated?.()
    } catch (error) {
      console.error(isEditing ? 'Failed to update space collection:' : 'Failed to create space collection:', error)
    } finally {
      setIsSaving(false)
    }
  }, [
    canSave,
    dispatch,
    group?.id,
    name,
    icon,
    spaces,
    isEditing,
    view?.id,
    view?.settings,
    onCreated,
    onAdd
  ])

  /** Set this collection as the group's home view (order = 0). */
  const handleSetHome = useCallback(async () => {
    if (!view?.id || !ownerGroup?.id) return
    if (!window.confirm(t('Set this view as the home view for the group?'))) return
    try {
      await dispatch(setHomeView({ viewId: view.id, groupId: ownerGroup.id }))
      await dispatch(fetchGroupViews(ownerGroup.id))
      if (ownerGroup.slug) await dispatch(fetchForGroup(ownerGroup.slug))
      onCancel?.()
    } catch (error) {
      console.error('Failed to set home view:', error)
    }
  }, [dispatch, view?.id, ownerGroup, onCancel, t])

  const handleSpaceCreated = useCallback(async (newSpace) => {
    setShowAddSpace(false)
    if (ownerGroup?.id) await dispatch(fetchGroupSpaces(ownerGroup.id))
    if (newSpace?.id) handleSelectSpace(newSpace)
  }, [dispatch, ownerGroup?.id, handleSelectSpace])

  const canBeHome = isEditing && view?.order !== 0

  return (
    <div className='fixed inset-0 z-[1100] flex items-center justify-center bg-darkening/50 p-4 pointer-events-auto'>
      <div className='bg-midground rounded-lg shadow-lg p-5 w-full max-w-md max-h-[85vh] flex flex-col'>
        <h2 className='text-lg font-semibold mb-4'>{t('Space Collection')}</h2>

        <div className='overflow-y-auto flex-1 min-h-0 flex flex-col gap-3 p-1'>
          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Name')}</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('Name')} />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Icon')}</label>
            <LucideIconPicker value={icon} onChange={setIcon} />
          </div>

          <div className='flex flex-col gap-1'>
            <label className='text-sm text-foreground/70'>{t('Spaces')}</label>
            <p className='text-xs text-foreground/50 mb-1'>
              <span>{spaces.length}</span> <span>{t('spaces in this collection')}</span>
            </p>
            <SpaceSelector
              spaces={visibleSpaces}
              selectedSpaces={spaces}
              draggable
              onSelectSpace={handleSelectSpace}
              onRemoveSpace={handleRemoveSpace}
              onReorderSpace={handleReorderSpace}
              onCreateSpace={() => setShowAddSpace(true)}
            />
          </div>
        </div>

        <div className='flex flex-wrap gap-2 mt-4 pt-2 border-t border-foreground/10'>
          <Button variant='primary' onClick={onCancel}>
            {isEditing ? t('Cancel') : t('Back')}
          </Button>
          {canBeHome && (
            <Button variant='secondary' onClick={handleSetHome} className='flex items-center gap-1'>
              <House className='w-4 h-4' />
              {t('Set as Home View')}
            </Button>
          )}
          <div className='flex-1' />
          <Button variant='secondary' disabled={!canSave || isSaving} onClick={handleSave}>
            {isSaving
              ? (isEditing ? t('Saving...') : t('Creating...'))
              : (isEditing ? t('Save') : t('Add View'))}
          </Button>
        </div>
      </div>

      {showAddSpace && (
        <AddSpaceDialog
          group={ownerGroup || group}
          addToMenu={false}
          onClose={() => setShowAddSpace(false)}
          onCreated={handleSpaceCreated}
        />
      )}
    </div>
  )
}
