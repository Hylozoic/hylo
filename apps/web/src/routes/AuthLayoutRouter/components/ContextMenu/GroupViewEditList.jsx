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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronRight, GripVertical } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

import GroupViewIcon from './GroupViewIcon'
import { GroupViewEditActions } from './GroupViewSettingsModal'
import { canDeleteView } from 'store/models/GroupView'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { deleteGroupView, reorderGroupView, setHomeView } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { mergeOrderedViewsFromSource } from 'store/util/groupViewsOrder'
import { cn } from 'util/index'

/** Sort views by menu order for consistent drag indices. */
function sortViewsByOrder (views) {
  return [...(views || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

/** Map a sortable drop to the reorder API params.
 * Uses finalOrder (after arrayMove) so dragging DOWN correctly identifies the
 * item that should follow the moved view, matching backend insert-before semantics. */
function getReorderParams (finalOrder, newIndex) {
  if (newIndex === 0) return { type: 'home' }
  if (newIndex === finalOrder.length - 1) return { addToEnd: true }
  return { orderInFrontOfViewId: finalOrder[newIndex + 1].id }
}

/** Call the reorder or setHomeView mutation — Redux is updated optimistically via _PENDING handlers. */
async function persistViewReorder (dispatch, movedView, params, { parentGroupId, targetGroupId, reorderedItems }) {
  const syncMeta = { parentGroupId, targetGroupId, reorderedItems }
  if (params.type === 'home') {
    await dispatch(setHomeView({ viewId: movedView.id, groupId: targetGroupId, ...syncMeta }))
    return
  }
  if (params.addToEnd) {
    await dispatch(reorderGroupView({ id: movedView.id, addToEnd: true, ...syncMeta }))
    return
  }
  await dispatch(reorderGroupView({
    id: movedView.id,
    orderInFrontOfViewId: params.orderInFrontOfViewId,
    ...syncMeta
  }))
}

/** Single draggable row in edit mode. */
function SortableEditRow ({ view, onSettings, onDelete, isHome }) {
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

  if (presentedView.type === 'separator') {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className='list-none flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group'
      >
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <hr className='flex-1 border-foreground/10' />
        <GroupViewEditActions view={view} onSettings={onSettings} onDelete={onDelete} className='opacity-0 group-hover:opacity-100' />
      </li>
    )
  }

  if (presentedView.type === 'text') {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className='list-none flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group'
      >
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <p className='flex-1 text-xs text-foreground/40 uppercase tracking-wide truncate'>
          {displayNameForView(presentedView, t)}
        </p>
        <GroupViewEditActions view={view} onSettings={onSettings} onDelete={onDelete} className='opacity-0 group-hover:opacity-100' />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className='list-none flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group'
    >
      <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
        <GripVertical className='w-4 h-4' />
      </button>
      <GroupViewIcon view={presentedView} />
      <span className='flex-1 truncate text-base text-foreground'>
        {displayNameForView(presentedView, t)}
        {isHome && <span className='ml-1 text-xs text-foreground/50'>({t('Home')})</span>}
      </span>
      <GroupViewEditActions
        view={view}
        onSettings={onSettings}
        onDelete={onDelete}
        className='opacity-0 group-hover:opacity-100'
      />
    </li>
  )
}

/** Space row with optional nested editable sub-views. */
function SortableSpaceEditRow ({ view, group, onSettings, onDelete, onReorder, onSpaceViewsReordered }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(true)
  const presentedView = GroupViewPresenter(view)
  const spaceViews = sortViewsByOrder(presentedView.linkedGroup?.groupViews?.items || [])
  const spaceGroupId = presentedView.linkedGroup?.id

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(view.id),
    disabled: !view.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <li ref={setNodeRef} style={style} className='list-none'>
      <div className='flex items-center gap-1 border-2 border-dashed border-transparent hover:border-foreground/20 rounded-md p-1 group'>
        <button type='button' className='p-1 cursor-grab text-foreground/50 shrink-0' {...attributes} {...listeners}>
          <GripVertical className='w-4 h-4' />
        </button>
        <GroupViewIcon view={presentedView} />
        <span className='flex-1 truncate text-base text-foreground'>
          {displayNameForView(presentedView, t)}
        </span>
        <GroupViewEditActions
          view={view}
          onSettings={onSettings}
          onDelete={onDelete}
          className='opacity-0 group-hover:opacity-100'
        />
        {spaceViews.length > 0 && (
          <button
            type='button'
            className='p-1 text-foreground/50 hover:text-foreground'
            onClick={() => setExpanded(v => !v)}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
          </button>
        )}
      </div>
      {expanded && spaceViews.length > 0 && spaceGroupId && (
        <ul className='pl-6 mt-1'>
          <GroupViewEditSubList
            views={spaceViews}
            groupId={spaceGroupId}
            parentGroupId={group?.id}
            onSettings={onSettings}
            onDelete={onDelete}
            onReorder={onReorder}
            onReordered={(newItems) => onSpaceViewsReordered(view.id, newItems)}
          />
        </ul>
      )}
    </li>
  )
}

/** Nested sortable list for views inside a space. */
function GroupViewEditSubList ({ views, groupId, parentGroupId, onSettings, onDelete, onReorder, onReordered }) {
  const sortedViews = useMemo(() => sortViewsByOrder(views), [views])
  const [orderedViews, setOrderedViews] = useState(sortedViews)

  // Merge Redux updates into local order (preserves drag order; full replace on add/delete).
  useEffect(() => {
    setOrderedViews(prev => mergeOrderedViewsFromSource(prev, sortedViews))
  }, [sortedViews])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const ids = orderedViews.map(v => String(v.id))

  const handleDragEnd = (event) => {
    onReorder(event, orderedViews, groupId, {
      setLocalViews: setOrderedViews,
      onReordered,
      parentGroupId
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {orderedViews.map((view, index) => (
          <SortableEditRow
            key={view.id}
            view={view}
            onSettings={onSettings}
            onDelete={onDelete}
            isHome={index === 0}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

/** Drag-and-drop editable list of group views. */
export default function GroupViewEditList ({ views, group, onSettings }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const sortedViews = useMemo(() => sortViewsByOrder(views), [views])
  const [orderedViews, setOrderedViews] = useState(sortedViews)

  // Merge Redux updates into local order (preserves drag order; full replace on add/delete).
  useEffect(() => {
    setOrderedViews(prev => mergeOrderedViewsFromSource(prev, sortedViews))
  }, [sortedViews])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleReorder = useCallback(async (event, listViews, targetGroupId, { setLocalViews, onReordered, parentGroupId } = {}) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = listViews.findIndex(v => String(v.id) === String(active.id))
    const newIndex = listViews.findIndex(v => String(v.id) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const movedView = listViews[oldIndex]
    const finalOrder = arrayMove(listViews, oldIndex, newIndex)
    const params = getReorderParams(finalOrder, newIndex)
    const resolvedParentGroupId = parentGroupId || group?.id

    const applyLocal = setLocalViews || setOrderedViews
    applyLocal(finalOrder)
    onReordered?.(finalOrder)

    try {
      await persistViewReorder(dispatch, movedView, params, {
        parentGroupId: resolvedParentGroupId,
        targetGroupId,
        reorderedItems: finalOrder
      })
    } catch (error) {
      console.error('Failed to reorder views:', error)
      applyLocal(listViews)
      onReordered?.(listViews)
      if (resolvedParentGroupId) {
        await dispatch(fetchGroupViews(resolvedParentGroupId))
      }
    }
  }, [dispatch, group?.id])

  const handleSpaceViewsReordered = useCallback((spaceViewId, newItems) => {
    setOrderedViews(prev => prev.map(v => {
      if (String(v.id) !== String(spaceViewId) || !v.linkedGroup) return v
      return {
        ...v,
        linkedGroup: {
          ...v.linkedGroup,
          groupViews: {
            ...v.linkedGroup.groupViews,
            items: newItems
          }
        }
      }
    }))
  }, [])

  const handleDelete = useCallback(async (view) => {
    if (!canDeleteView(view) || !group?.id) return
    const label = displayNameForView(view, t)
    if (!window.confirm(t('Are you sure you want to remove {{name}} from the menu?', { name: label }))) return
    try {
      await dispatch(deleteGroupView(view.id, group.id))
    } catch (error) {
      console.error('Failed to delete view:', error)
    }
  }, [dispatch, group?.id, t])

  const ids = orderedViews.map(v => String(v.id))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => handleReorder(e, orderedViews, group.id, { parentGroupId: group.id })}
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
                  group={group}
                  onSettings={onSettings}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                  onSpaceViewsReordered={handleSpaceViewsReordered}
                />
              )
            }
            return (
              <SortableEditRow
                key={view.id}
                view={view}
                onSettings={onSettings}
                onDelete={handleDelete}
                isHome={index === 0}
              />
            )
          })}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
