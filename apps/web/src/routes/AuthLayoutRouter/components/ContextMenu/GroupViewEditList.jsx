import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Ellipsis, GripVertical, Pencil } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { addQuerystringToPath } from '@hylo/navigation'
import { spaceEntryUrl } from './groupViewMenuUrl'

import { Tooltip, TooltipContent, TooltipTrigger } from 'components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'components/ui/dropdown-menu'
import TruncatedText from 'components/TruncatedText'
import GroupViewIcon from './GroupViewIcon'
import { GroupViewEditActions } from './GroupViewSettingsModal'
import { canDeleteView, canHardDeleteView, isSoftRemoveView, viewTypeHasSettings } from 'store/models/GroupView'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { deleteGroupView, deleteSpace, setGroupViewHidden, updateGroupView } from 'store/actions/groupViews'
import { appendSpaceId, collectionsWithoutSpace, spaceCollectionViews } from 'util/spaceCollection'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import { mergeOrderedViewsFromSource, sortViewsByMenuOrder } from 'store/util/groupViewsOrder'
import { cn } from 'util/index'
import useViewReorder from './useViewReorder'
import useFlashAddedItems, { MENU_FLASH_CLASS } from './useFlashAddedItems'

/** Sort views by menu order for consistent drag indices (hidden last). */
function sortViewsByOrder (views) {
  return sortViewsByMenuOrder(views)
}

// Pointer devices keep the hover-reveal; touch has no hover, so the icons stay up.
const EDIT_ACTIONS_CLASS = 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100'

/** Single draggable row in edit mode. */
function SortableEditRow ({ view, onSettings, onHide, onDelete, isHome, spaceGroup = null, isFlashing = false }) {
  const { t } = useTranslation()
  const presentedView = GroupViewPresenter(view)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(view.id),
    disabled: !view.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const rowClass = cn(
    'list-none flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group',
    isFlashing && MENU_FLASH_CLASS
  )
  const flashProps = isFlashing ? { 'data-menu-flash': String(view.id) } : {}

  if (presentedView.type === 'separator') {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={rowClass}
        {...flashProps}
      >
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <hr className='flex-1 border-foreground/10' />
        <GroupViewEditActions view={view} onSettings={onSettings} onHide={onHide} onDelete={onDelete} className={EDIT_ACTIONS_CLASS} />
      </li>
    )
  }

  if (presentedView.type === 'text') {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={rowClass}
        {...flashProps}
      >
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <TruncatedText
          as='p'
          className='flex-1 min-w-0 text-xs text-foreground/40 uppercase tracking-wide truncate'
          text={displayNameForView(presentedView, t, { spaceGroup })}
        />
        <GroupViewEditActions view={view} onSettings={onSettings} onHide={onHide} onDelete={onDelete} className={EDIT_ACTIONS_CLASS} />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={rowClass}
      {...flashProps}
    >
      <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
        <GripVertical className='w-4 h-4' />
      </button>
      <GroupViewIcon view={presentedView} />
      <span className='flex-1 min-w-0 flex items-center gap-1 text-base font-semibold text-foreground'>
        <TruncatedText className='truncate min-w-0' text={displayNameForView(presentedView, t, { spaceGroup })} />
        {/* Same badge treatment as the header's Editing pill */}
        {isHome && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className='text-xs font-semibold rounded-full border border-foreground/20 bg-foreground/10 text-foreground/70 px-2 py-px leading-none self-center shrink-0'>
                {t('Home')}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('When people return to this group, this is what they see first.')}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <GroupViewEditActions
        view={view}
        onSettings={onSettings}
        onHide={onHide}
        onDelete={onDelete}
        className={EDIT_ACTIONS_CLASS}
      />
    </li>
  )
}

/** Overflow for space rows: settings, add to collection, remove, delete. Pencil stays outside. */
function SpaceEditRowMenu ({
  view,
  space,
  collectionViews,
  onSettings,
  onAddToCollection,
  onHide,
  onDelete
}) {
  const { t } = useTranslation()
  const showSettings = viewTypeHasSettings(view?.type)
  const removable = canDeleteView(view)
  const hardDeletable = canHardDeleteView(view)
  const softRemovable = removable && isSoftRemoveView(view)
  const availableCollections = collectionsWithoutSpace(collectionViews, space?.id)

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='p-1 text-foreground/50 hover:text-foreground rounded'
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={t('More actions')}
            >
              <Ellipsis className='w-4 h-4' />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('More actions')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='end' className='z-[200]' onClick={(e) => e.stopPropagation()}>
        {showSettings && (
          <DropdownMenuItem onSelect={() => onSettings?.(view)}>
            {t('Settings')}
          </DropdownMenuItem>
        )}
        {availableCollections.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('Add to Collection')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='z-[200]'>
              {availableCollections.map(collectionView => (
                <DropdownMenuItem
                  key={collectionView.id}
                  onSelect={() => onAddToCollection?.(space, collectionView)}
                >
                  {collectionView.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {softRemovable && onHide && (
          <DropdownMenuItem onSelect={() => onHide(view)}>
            {t('Remove from main menu')}
          </DropdownMenuItem>
        )}
        {hardDeletable && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onSelect={() => onDelete(view)}
            >
              {t('Delete Space')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Space row — pencil drills into that space's menu in edit mode (no nested expand). */
function SortableSpaceEditRow ({
  view,
  groupSlug,
  collectionViews,
  onSettings,
  onAddToCollection,
  onHide,
  onDelete
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const presentedView = GroupViewPresenter(view)
  const spaceGroup = presentedView.linkedGroup

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(view.id),
    disabled: !view.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  /** Open this space's home with its menu in edit mode. */
  const handleEditSpaceMenu = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!groupSlug || !spaceGroup?.slug) return
    navigate(addQuerystringToPath(spaceEntryUrl(groupSlug, spaceGroup), { edit: 'true' }))
  }, [navigate, groupSlug, spaceGroup])

  return (
    <li ref={setNodeRef} style={style} className='list-none'>
      <div className='flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group'>
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <GroupViewIcon view={presentedView} />
        <TruncatedText className='flex-1 min-w-0 truncate text-base font-semibold text-foreground' text={displayNameForView(presentedView, t)} />
        <div className={cn('flex items-center shrink-0', EDIT_ACTIONS_CLASS)}>
          <SpaceEditRowMenu
            view={view}
            space={spaceGroup}
            collectionViews={collectionViews}
            onSettings={onSettings}
            onAddToCollection={onAddToCollection}
            onHide={onHide}
            onDelete={onDelete}
          />
          {spaceGroup?.slug && groupSlug && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  className='p-1 text-foreground/50 hover:text-foreground'
                  onClick={handleEditSpaceMenu}
                  aria-label={t('Edit space menu')}
                >
                  <Pencil className='w-4 h-4' />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('Edit space menu')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  )
}

/** Drag-and-drop editable list of group views. */
export default function GroupViewEditList ({ views, group, groupSlug, onSettings }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const visibleViews = useMemo(() => sortViewsByOrder(
    (views || []).filter(v => v.order != null)
  ), [views])
  const [orderedViews, setOrderedViews] = useState(visibleViews)

  // Merge Redux updates into local order (preserves drag order; full replace on add/delete).
  useEffect(() => {
    setOrderedViews(prev => mergeOrderedViewsFromSource(prev, visibleViews))
  }, [visibleViews])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleReorder = useViewReorder(group)

  const handleHide = useCallback(async (view) => {
    if (!isSoftRemoveView(view) || !canDeleteView(view) || !group?.id) return
    const label = displayNameForView(view, t)
    if (!window.confirm(t('Are you sure you want to remove {{name}} from the menu?', { name: label }))) return
    try {
      await dispatch(setGroupViewHidden({
        id: view.id,
        groupId: group.id,
        hidden: true
      }))
    } catch (error) {
      console.error('Failed to remove view from menu:', error)
    }
  }, [dispatch, group?.id, t])

  const collectionViews = useMemo(
    () => spaceCollectionViews(views).map(view => ({
      id: view.id,
      name: displayNameForView(view, t),
      settings: view.settings
    })),
    [views, t]
  )

  const handleAddToCollection = useCallback(async (space, collectionView) => {
    if (!group?.id || !space?.id || !collectionView?.id) return
    const fullView = (views || []).find(v => String(v.id) === String(collectionView.id))
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
  }, [dispatch, group?.id, views])

  const handleDelete = useCallback(async (view) => {
    if (!canHardDeleteView(view) || !group?.id) return
    if (view.type === 'space') {
      const space = view.linkedGroup
      if (!space?.id) return
      const confirmed = window.confirm(
        t('Are you sure you want to permanently delete {{name}}? Posts in this space will no longer be accessible.', {
          name: space.name || displayNameForView(view, t)
        })
      )
      if (!confirmed) return
      try {
        await dispatch(deleteSpace(space.id))
        await dispatch(fetchGroupSpaces(group.id))
        await dispatch(fetchGroupViews(group.id))
      } catch (error) {
        console.error('Failed to delete space:', error)
      }
      return
    }
    const label = displayNameForView(view, t)
    if (!window.confirm(t('Are you sure you want to delete {{name}}?', { name: label }))) return
    try {
      await dispatch(deleteGroupView(view.id, group.id))
    } catch (error) {
      console.error('Failed to delete view:', error)
    }
  }, [dispatch, group?.id, t])

  const ids = orderedViews.map(v => String(v.id))
  // Two-column creates a space then opens it, so flashing the sidebar row is noise.
  const flashingIds = useFlashAddedItems(orderedViews, { skipTypes: ['space'] })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => handleReorder(e, orderedViews, group.id, { setLocalViews: setOrderedViews, parentGroupId: group.id })}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className='m-0 p-3 mb-2'>
          {orderedViews.map((view, index) => {
            if (view.type === 'space') {
              return (
                <SortableSpaceEditRow
                  key={view.id}
                  view={view}
                  groupSlug={groupSlug || group?.slug}
                  collectionViews={collectionViews}
                  onSettings={onSettings}
                  onAddToCollection={handleAddToCollection}
                  onHide={handleHide}
                  onDelete={handleDelete}
                />
              )
            }
            return (
              <SortableEditRow
                key={view.id}
                view={view}
                onSettings={onSettings}
                onHide={handleHide}
                onDelete={handleDelete}
                isHome={index === 0}
                isFlashing={flashingIds.has(String(view.id))}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
