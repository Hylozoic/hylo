import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { addQuerystringToPath, localSpaceSlug, spaceUrl } from '@hylo/navigation'

import { canDeleteView, canHardDeleteView, isMenuViewVisible, isSoftRemoveView } from 'store/models/GroupView'
import { archiveSpace, setGroupViewHidden } from 'store/actions/groupViews'
import fetchGroupSpaces from 'store/actions/fetchGroupSpaces'
import fetchGroupViews from 'store/actions/fetchGroupViews'
import { mergeOrderedViewsFromSource, sortViewsByMenuOrder } from 'store/util/groupViewsOrder'
import { cn } from 'util/index'

import GroupViewCard, { CardEditActions } from './GroupViewCard'
import { CARD_SIZE_CLASS } from './viewCardTheme'
import { useCommitViewOrder } from './useViewReorder'
import useFlashAddedItems, { MENU_FLASH_CLASS } from './useFlashAddedItems'

// Mouse drags start as soon as the pointer travels a few pixels. Touch needs the
// hold instead, because a finger moving over a card is a scroll until proven
// otherwise — which is also why the cards need no touch-action override.
// These have to be separate sensors: a delay constraint on a shared PointerSensor
// applies the hold to the mouse as well, and any movement inside the delay
// cancels activation, so an ordinary press-and-drag never starts.
const MOUSE_ACTIVATION = { distance: 5 }
const TOUCH_ACTIVATION = { delay: 180, tolerance: 8 }

// A card is a drag handle, not prose. Without this the hold that starts a touch
// drag is also the gesture iOS uses to select text, so the loupe appears and a
// selection is left behind on release. Needed on the overlay as much as on the
// item: DragOverlay portals its content out of the wrapper, so the card actually
// under the finger inherits nothing from it.
const NO_TEXT_SELECT = 'select-none [-webkit-touch-callout:none]'

// The grid reorders its real DOM on drag-over, so droppable rects must be
// re-measured after every reflow. With the default drag-start-only measuring,
// collisions keep being computed against the pre-reflow layout and the same
// swap gets detected (and undone) over and over — the infinite jumping loop
// when a full-width row lands mid-row and moves everything by a card height.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } }

// How much of an idle item's rect counts as its inert body (per side).
const CARD_BODY_INSET = 0.28

/**
 * Reorder only from the spaces between and around the cards. The central body
 * of every idle item is inert — a pointer resting on a card is browsing, not
 * aiming, so hovering a card never pushes it aside. This is also what makes the
 * live reflow stable: when a reorder lands a card under the stationary pointer,
 * the pointer is in that card's body, which cannot produce a new target, so the
 * layout cannot bounce back (the oscillation).
 *
 * Everything is anchored to the pointer, never to the dragged item's rect — a
 * full-width row's rect is centered on the container, so rect-based collision
 * (closestCenter) kept picking targets nowhere near the pointer. The winning
 * collision carries which side of the target the pointer is on, so the drop
 * lands at exactly the gap being hovered. Keyboard drags have no pointer and
 * keep plain closest-center.
 */
const gapCollisionDetection = (args) => {
  const { active, droppableRects, droppableContainers, pointerCoordinates } = args
  if (!pointerCoordinates) return closestCenter(args)
  const candidates = []
  for (const container of droppableContainers) {
    if (String(container.id) === String(active.id)) continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue
    const insetX = Math.max(10, rect.width * CARD_BODY_INSET)
    const insetY = Math.max(10, rect.height * CARD_BODY_INSET)
    if (
      pointerCoordinates.x >= rect.left + insetX &&
      pointerCoordinates.x <= rect.right - insetX &&
      pointerCoordinates.y >= rect.top + insetY &&
      pointerCoordinates.y <= rect.bottom - insetY
    ) {
      return []
    }
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const withinRow = pointerCoordinates.y >= rect.top && pointerCoordinates.y <= rect.bottom
    const side = withinRow
      ? (pointerCoordinates.x < cx ? 'before' : 'after')
      : (pointerCoordinates.y < cy ? 'before' : 'after')
    candidates.push({
      id: container.id,
      data: { side, value: Math.hypot(pointerCoordinates.x - cx, pointerCoordinates.y - cy) }
    })
  }
  candidates.sort((a, b) => a.data.value - b.data.value)
  return candidates.length ? [candidates[0]] : []
}

/** True for views that occupy a full wrap-grid row instead of a card cell. */
function isFullWidthGridView (view) {
  const type = view?.type
  return type === 'text' || type === 'separator'
}

/** Full-width stand-ins for text and separator rows so they reorder with the cards. */
function FullWidthRow ({ view, group, spaceGroup, t }) {
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
const SortableViewItem = React.memo(function SortableViewItem ({ view, group, spaceGroup, onOpenSettings, onHide, onArchive, onDelete, onEditSpaceMenu, t, isFlashing = false }) {
  const presented = useMemo(() => GroupViewPresenter(view), [view])
  const isFullWidth = isFullWidthGridView(presented)
  const { attributes, listeners, setNodeRef, isDragging, isSorting } = useSortable({
    id: String(view.id),
    disabled: !view.id
  })
  const canEditSpaceMenu = presented.type === 'space' && presented.linkedGroup?.slug && onEditSpaceMenu
  const canHide = onHide && isSoftRemoveView(view) && canDeleteView(view)
  const canArchive = onArchive && view.type === 'space' && view.linkedGroup?.status !== 'archived'

  return (
    <div
      ref={setNodeRef}
      // Deliberately no transform from useSortable. Its sorting preview paints
      // translations over the pre-drag layout, which assumes evenly sized items —
      // with full-width text rows among the cards it slid them into the card rows.
      // The grid reorders itself for real on drag-over instead, so flex-wrap keeps
      // a full-width row breaking the line and starting its own.
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        'group relative cursor-grab active:cursor-grabbing',
        NO_TEXT_SELECT,
        // The wrapper carries the card footprint so the card's sub-sm percentage
        // width has a sized parent to resolve against
        isFullWidth ? 'w-full' : CARD_SIZE_CLASS,
        !isFullWidth && 'rounded-2xl',
        isDragging && 'cursor-grabbing',
        // Cards animate a translate on hover (transition-all); a card reflowing
        // under the stationary pointer mid-drag would trigger it and jitter the
        // rects the collision math depends on. No pointer events, no hover.
        isSorting && '[&_*]:pointer-events-none',
        isFlashing && MENU_FLASH_CLASS
      )}
      data-menu-flash={isFlashing ? String(view.id) : undefined}
      {...attributes}
      {...listeners}
    >
      {isFullWidth
        ? <FullWidthRow view={view} group={group} spaceGroup={spaceGroup} t={t} />
        : <GroupViewCard view={view} group={group} spaceGroup={spaceGroup} isEditing />}
      <CardEditActions
        onOpenSettings={onOpenSettings ? () => onOpenSettings(view) : null}
        onHide={canHide ? () => onHide(view) : null}
        onEditMenu={canEditSpaceMenu ? () => onEditSpaceMenu(view) : null}
        onArchive={canArchive ? () => onArchive(view) : null}
        onDelete={onDelete && canHardDeleteView(view) ? () => onDelete(view) : null}
        settingsLabel={t('Settings')}
        hideLabel={t('Move to More Spaces')}
        editMenuLabel={t('Edit space menu')}
        archiveLabel={t('Archive')}
        deleteLabel={t('Delete')}
      />
    </div>
  )
})

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
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const commitOrder = useCommitViewOrder(group)
  const visibleViews = useMemo(
    () => sortViewsByMenuOrder(
      (views || []).filter(v => isMenuViewVisible(v, (spaceGroup || group)?.acceptedPostTypes))
    ),
    [views, spaceGroup?.acceptedPostTypes, group?.acceptedPostTypes]
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
  const flashingIds = useFlashAddedItems(orderedViews)

  /** Move a space off the main menu into More Spaces (same as the two-column X). */
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

  /** Archive a space: keep membership, drop the menu row, list under Archived. */
  const handleArchive = useCallback(async (view) => {
    const space = view?.linkedGroup
    if (!space?.id || space.status === 'archived' || !group?.id) return
    const confirmed = window.confirm(
      t('Are you sure you want to archive {{name}}?', {
        name: space.name || displayNameForView(view, t)
      })
    )
    if (!confirmed) return
    try {
      await dispatch(archiveSpace(space.id))
      await dispatch(fetchGroupSpaces(group.id))
      await dispatch(fetchGroupViews(group.id))
    } catch (error) {
      console.error('Failed to archive space:', error)
    }
  }, [dispatch, group?.id, t])

  /** Open this space's card menu in edit mode (one-column counterpart of the sidebar pencil). */
  const handleEditSpaceMenu = useCallback((view) => {
    const space = view?.linkedGroup
    const groupSlug = group?.slug
    if (!groupSlug || !space?.slug) return
    navigate(addQuerystringToPath(
      spaceUrl(groupSlug, localSpaceSlug(groupSlug, space.slug)),
      { edit: 'true' }
    ))
  }, [navigate, group?.slug])

  const [activeId, setActiveId] = useState(null)
  const activeView = useMemo(
    () => orderedViews.find(v => String(v.id) === activeId) || null,
    [orderedViews, activeId]
  )
  // The order as it stood before this drag, to roll back to if the mutation fails
  const preDragOrder = useRef(null)

  const handleDragStart = (e) => {
    // A selection made just before the press would otherwise survive the drag
    if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges?.()
    preDragOrder.current = orderedViews
    lastOverId.current = null
    lastReorderDelta.current = null
    setActiveId(String(e.active.id))
  }

  // The most recent over-target a reorder ran for. arrayMove is symmetric, so
  // re-processing the same target (after `over` flickers to null crossing a flex
  // gap) would move the item right back where it came from.
  const lastOverId = useRef(null)
  // Pointer translation at the last reorder: a reflow can surface a fresh target
  // under a pointer that hasn't moved, and reordering again from the same spot is
  // exactly the feedback loop. Require real travel between reorders.
  const lastReorderDelta = useRef(null)

  // Reorder as the pointer moves so the grid reflows for real — this is what keeps
  // a full-width row breaking its line instead of being painted over the cards.
  // The winning collision says which side of the target the pointer is on; the
  // dragged item is inserted at exactly that boundary.
  const handleDragOver = ({ active, over, delta, collisions }) => {
    if (!over || String(active.id) === String(over.id)) return
    const side = collisions?.[0]?.data?.side || 'before'
    const overKey = `${over.id}:${side}`
    if (overKey === lastOverId.current) return
    if (delta && lastReorderDelta.current) {
      const travelled = Math.hypot(
        delta.x - lastReorderDelta.current.x,
        delta.y - lastReorderDelta.current.y
      )
      if (travelled < 6) return
    }
    const oldIndex = orderedViews.findIndex(v => String(v.id) === String(active.id))
    const overIndex = orderedViews.findIndex(v => String(v.id) === String(over.id))
    if (oldIndex === -1 || overIndex === -1) return
    let insertIndex = side === 'after' ? overIndex + 1 : overIndex
    if (oldIndex < insertIndex) insertIndex -= 1
    // Both sides of one gap name the same slot; landing where we already are
    // still marks the key handled so the pair can't ping-pong.
    lastOverId.current = overKey
    if (insertIndex === oldIndex) return
    lastReorderDelta.current = delta || null
    setOrderedViews(prev => {
      const from = prev.findIndex(v => String(v.id) === String(active.id))
      const to = prev.findIndex(v => String(v.id) === String(over.id))
      if (from === -1 || to === -1) return prev
      let target = side === 'after' ? to + 1 : to
      if (from < target) target -= 1
      if (target === from) return prev
      return arrayMove(prev, from, target)
    })
  }

  const handleDragEnd = () => {
    const previousOrder = preDragOrder.current
    const movedId = activeId
    preDragOrder.current = null
    setActiveId(null)
    if (!movedId || !previousOrder) return
    // Nothing to persist when the drag ended where it began
    if (previousOrder.map(v => String(v.id)).join() === orderedViews.map(v => String(v.id)).join()) return

    commitOrder(orderedViews, movedId, targetGroupId || group?.id, {
      previousOrder,
      setLocalViews: setOrderedViews,
      parentGroupId: group?.id
    })
  }

  const handleDragCancel = () => {
    if (preDragOrder.current) setOrderedViews(preDragOrder.current)
    preDragOrder.current = null
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={gapCollisionDetection}
      measuring={MEASURING}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className='flex flex-wrap gap-3'>
          {orderedViews.map(view => (
            <SortableViewItem
              key={view.id}
              view={view}
              group={group}
              spaceGroup={spaceGroup}
              onOpenSettings={onOpenSettings}
              onHide={handleHide}
              onArchive={handleArchive}
              onDelete={onDelete}
              onEditSpaceMenu={handleEditSpaceMenu}
              t={t}
              isFlashing={flashingIds.has(String(view.id))}
            />
          ))}
        </div>
      </SortableContext>
      {/* The dragged item rides along at its natural size, so the in-flow copy never
          has to be re-fitted around items of a different shape */}
      <DragOverlay className={NO_TEXT_SELECT}>
        {activeView
          ? (isFullWidthGridView(activeView)
              ? <FullWidthRow view={activeView} group={group} spaceGroup={spaceGroup} t={t} />
              : <GroupViewCard view={activeView} group={group} spaceGroup={spaceGroup} isEditing />)
          : null}
      </DragOverlay>
    </DndContext>
  )
}
