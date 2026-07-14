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
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVertical, X } from 'lucide-react'

import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import AddGroupViewDialog, { AddViewButton } from 'routes/AuthLayoutRouter/components/ContextMenu/AddGroupViewDialog'

/** Standard view types that can be reordered but never removed from Included Views. */
const NON_REMOVABLE_STANDARD_TYPES = new Set(['track-actions', 'funding-round-submissions'])

/** Keeps drag order stable across renders: preserves the order of keys still present,
 * appends any brand-new keys at the end, and drops keys that no longer exist. */
function mergeViewOrder (prevOrder, currentKeys) {
  const currentSet = new Set(currentKeys)
  const kept = prevOrder.filter(key => currentSet.has(key))
  const keptSet = new Set(kept)
  const added = currentKeys.filter(key => !keptSet.has(key))
  return [...kept, ...added]
}

/** Single draggable row in the Included Views editor. */
function SortableViewRow ({ rowKey, row, isHome, onRemove, t }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowKey })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  const presentedView = GroupViewPresenter({ type: row.type, name: row.name, pageContent: row.pageContent })
  const rowLabel = row.name || displayNameForView(presentedView, t)

  return (
    <li ref={setNodeRef} style={style} className='list-none flex items-center gap-1 border-2 border-foreground/10 rounded-md p-1 pl-1'>
      <button type='button' className='p-1 cursor-grab text-foreground/40 shrink-0' {...attributes} {...listeners} aria-label={t('Drag to reorder')}>
        <GripVertical className='w-3.5 h-3.5' />
      </button>
      <GroupViewIcon view={presentedView} className='w-4 h-4 shrink-0 text-foreground/70 mr-2' />
      <span className='flex-1 text-sm text-foreground truncate'>
        {rowLabel}
        {isHome && <span className='ml-1 text-xs text-foreground/50'>({t('Home')})</span>}
      </span>
      {row.removable && (
        <button
          type='button'
          onClick={onRemove}
          className='p-1 text-foreground/40 hover:text-foreground transition-colors'
          aria-label={t('Remove view')}
        >
          <X className='w-3.5 h-3.5' />
        </button>
      )}
    </li>
  )
}

/** Reorderable, addable/removable list of Included Views — shared by AddSpaceDialog and CreateGroup.
 * `standardViewTypes` are the always-derived rows (e.g. from accepted post types); the caller owns
 * removing/re-adding them. `manualViews` are custom/link/text/etc rows staged via the Add View dialog.
 * Reports the final ordered row list back via `onOrderedRowsChange` for the caller to use on submit. */
export default function IncludedViewsEditor ({
  standardViewTypes,
  onRemoveStandardType,
  manualViews,
  onAddView,
  onRemoveManualView,
  acceptedPostTypes,
  onOrderedRowsChange
}) {
  const { t } = useTranslation()
  const [viewOrder, setViewOrder] = useState([])
  const [showAddViewDialog, setShowAddViewDialog] = useState(false)

  const rowsByKey = useMemo(() => {
    const rows = {}
    standardViewTypes.forEach(type => {
      rows[type] = { key: type, kind: 'standard', type, removable: !NON_REMOVABLE_STANDARD_TYPES.has(type) }
    })
    manualViews.forEach(view => {
      rows[view.key] = { ...view, kind: 'manual', removable: true }
    })
    return rows
  }, [standardViewTypes, manualViews])

  const rowKeys = useMemo(() => Object.keys(rowsByKey), [rowsByKey])

  useEffect(() => {
    setViewOrder(prev => mergeViewOrder(prev, rowKeys))
  }, [rowKeys])

  const orderedRows = useMemo(
    () => viewOrder.map(key => rowsByKey[key]).filter(Boolean),
    [viewOrder, rowsByKey]
  )

  useEffect(() => {
    onOrderedRowsChange?.(orderedRows)
  }, [orderedRows])

  const combinedViewsForAddDialog = useMemo(
    () => orderedRows.map(row => ({ type: row.type })),
    [orderedRows]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setViewOrder(prev => {
      const oldIndex = prev.indexOf(active.id)
      const newIndex = prev.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  return (
    <div className='flex flex-col gap-2'>
      <label className='text-sm text-foreground/70'>{t('Included Views')}</label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={viewOrder} strategy={verticalListSortingStrategy}>
          <ul className='flex flex-col gap-1 m-0 p-0'>
            {orderedRows.map((row, index) => (
              <SortableViewRow
                key={row.key}
                rowKey={row.key}
                row={row}
                isHome={index === 0}
                onRemove={() => row.kind === 'standard' ? onRemoveStandardType(row.type) : onRemoveManualView(row.key)}
                t={t}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddViewButton onClick={() => setShowAddViewDialog(true)} />

      {showAddViewDialog && (
        <AddGroupViewDialog
          group={null}
          groupViews={combinedViewsForAddDialog}
          acceptedPostTypes={acceptedPostTypes}
          onAdd={onAddView}
          onClose={() => setShowAddViewDialog(false)}
        />
      )}
    </div>
  )
}
