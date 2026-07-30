import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { arrayMove } from '@dnd-kit/sortable'

import { canBeHomeView } from 'store/models/GroupView'
import { reorderGroupView, setHomeView } from 'store/actions/groupViews'
import fetchGroupViews from 'store/actions/fetchGroupViews'

/**
 * Map a sortable drop to the reorder API params.
 * Uses finalOrder (after arrayMove) so dragging DOWN correctly identifies the
 * item that should follow the moved view, matching backend insert-before semantics.
 */
export function getReorderParams (finalOrder, newIndex) {
  if (newIndex === 0) return { type: 'home' }
  if (newIndex === finalOrder.length - 1) return { addToEnd: true }
  return { orderInFrontOfViewId: finalOrder[newIndex + 1].id }
}

/** Call the reorder or setHomeView mutation — Redux is updated optimistically via _PENDING handlers. */
export async function persistViewReorder (dispatch, movedView, params, { parentGroupId, targetGroupId, reorderedItems }) {
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

/**
 * Commit an already-decided order. `previousOrder` is what to roll back to if the
 * mutation fails. Shared by both entry points below so the ordering rules — home
 * view at index 0, insert-before semantics, rollback and refetch on failure —
 * have a single implementation.
 */
async function commitOrder (dispatch, { finalOrder, movedView, newIndex, previousOrder, targetGroupId, parentGroupId, setLocalViews, onReordered }) {
  // External links (and other non-home types) cannot become the home view.
  if (!canBeHomeView(finalOrder[0])) {
    setLocalViews?.(previousOrder)
    onReordered?.(previousOrder)
    return
  }

  const params = getReorderParams(finalOrder, newIndex)

  setLocalViews?.(finalOrder)
  onReordered?.(finalOrder)

  try {
    await persistViewReorder(dispatch, movedView, params, {
      parentGroupId,
      targetGroupId,
      reorderedItems: finalOrder
    })
  } catch (error) {
    console.error('Failed to reorder views:', error)
    setLocalViews?.(previousOrder)
    onReordered?.(previousOrder)
    if (parentGroupId) {
      await dispatch(fetchGroupViews(parentGroupId))
    }
  }
}

/**
 * Drag-to-reorder handler for lists that keep their DOM order fixed during the
 * drag and hand over the dnd-kit event at the end.
 */
export default function useViewReorder (group) {
  const dispatch = useDispatch()

  return useCallback(async (event, listViews, targetGroupId, { setLocalViews, onReordered, parentGroupId } = {}) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = listViews.findIndex(v => String(v.id) === String(active.id))
    const newIndex = listViews.findIndex(v => String(v.id) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    await commitOrder(dispatch, {
      finalOrder: arrayMove(listViews, oldIndex, newIndex),
      movedView: listViews[oldIndex],
      newIndex,
      previousOrder: listViews,
      targetGroupId,
      parentGroupId: parentGroupId || group?.id,
      setLocalViews,
      onReordered
    })
  }, [dispatch, group?.id])
}

/**
 * Commit an order that the caller has already applied — for layouts that reorder
 * themselves live during the drag, where the list is final by the time the drag
 * ends.
 */
export function useCommitViewOrder (group) {
  const dispatch = useDispatch()

  return useCallback(async (finalOrder, movedId, targetGroupId, { previousOrder, setLocalViews, onReordered, parentGroupId } = {}) => {
    const newIndex = finalOrder.findIndex(v => String(v.id) === String(movedId))
    if (newIndex === -1) return

    await commitOrder(dispatch, {
      finalOrder,
      movedView: finalOrder[newIndex],
      newIndex,
      previousOrder: previousOrder || finalOrder,
      targetGroupId,
      parentGroupId: parentGroupId || group?.id,
      setLocalViews,
      onReordered
    })
  }, [dispatch, group?.id])
}
