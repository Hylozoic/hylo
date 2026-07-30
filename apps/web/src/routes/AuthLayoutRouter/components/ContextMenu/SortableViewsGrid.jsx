import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'

import { canHardDeleteView } from 'store/models/GroupView'
import { mergeOrderedViewsFromSource, sortViewsByMenuOrder } from 'store/util/groupViewsOrder'
import { cn } from 'util/index'

import GroupViewCard, { CardEditActions } from './GroupViewCard'
import useViewReorder from './useViewReorder'

// Mouse drags start as soon as the pointer travels a few pixels. Touch needs the
// hold instead, because a finger moving over a card is a scroll until proven
// otherwise — which is also why the cards need no touch-action override.
// These have to be separate sensors: a delay constraint on a shared PointerSensor
// applies the hold to the mouse as well, and any movement inside the delay
// cancels activation, so an ordinary press-and-drag never starts.
const MOUSE_ACTIVATION = { distance: 5 }
const TOUCH_ACTIVATION = { delay: 180, tolerance: 8 }

/** Full-width stand-ins for the text and separator rows, so they reorder with the cards. */
function FullWidthRow ({ view, spaceGroup, t }) {
  const presented = GroupViewPresenter(view)

  if (presented.type === 'separator') {
    return (
      <div className='flex items-center w-full py-2'>
        <hr className='flex-1 border-foreground/20 border-dashed' />
      </div>
    )
  }

  return (
    <p className='w-full text-base font-semibold text-foreground/70 px-1 m-0'>
      {displayNameForView(presented, t, { spaceGroup })}
    </p>
  )
}

/**
 * One draggable grid item. The drag listeners sit on the wrapper so a press
 * anywhere on the card starts the drag; the toolbar stops pointerdown so its
 * buttons stay clickable instead of becoming drag handles.
 */
function SortableViewItem ({ view, spaceGroup, onOpenSettings, onDelete, t }) {
  const presented = GroupViewPresenter(view)
  const isFullWidth = presented.type === 'text' || presented.type === 'separator'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(view.id),
    disabled: !view.id
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 20 : undefined
      }}
      className={cn(
        'group relative cursor-grab active:cursor-grabbing',
        isFullWidth && 'w-full',
        isDragging && 'cursor-grabbing'
      )}
      {...attributes}
      {...listeners}
    >
      {isFullWidth
        ? <FullWidthRow view={view} spaceGroup={spaceGroup} t={t} />
        : <GroupViewCard view={view} isEditing renderEditActions={false} />}
      <CardEditActions
        onOpenSettings={onOpenSettings ? () => onOpenSettings(view) : null}
        onDelete={onDelete && canHardDeleteView(view) ? () => onDelete(view) : null}
        settingsLabel={t('Settings')}
        deleteLabel={t('Delete')}
      />
    </div>
  )
}

/**
 * Drag-to-reorder card grid for edit mode — the card equivalent of
 * GroupViewEditList, sharing its ordering rules through useViewReorder. Views
 * are one flat sortable list (text and separator rows included, laid out full
 * width) so a drop maps to the same order the menu is stored in.
 */
export default function SortableViewsGrid ({
  views,
  group,
  targetGroupId,
  spaceGroup = null,
  onOpenSettings,
  onDelete
}) {
  const { t } = useTranslation()
  const handleReorder = useViewReorder(group)
  const visibleViews = useMemo(
    () => sortViewsByMenuOrder((views || []).filter(v => v.order != null)),
    [views]
  )
  const [orderedViews, setOrderedViews] = useState(visibleViews)

  // Merge Redux updates into local order (preserves drag order; full replace on add/delete).
  useEffect(() => {
    setOrderedViews(prev => mergeOrderedViewsFromSource(prev, visibleViews))
  }, [visibleViews])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: MOUSE_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const ids = useMemo(() => orderedViews.map(v => String(v.id)), [orderedViews])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(e) => handleReorder(e, orderedViews, targetGroupId || group?.id, {
        setLocalViews: setOrderedViews,
        parentGroupId: group?.id
      })}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className='flex flex-wrap gap-3'>
          {orderedViews.map(view => (
            <SortableViewItem
              key={view.id}
              view={view}
              spaceGroup={spaceGroup}
              onOpenSettings={onOpenSettings}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
