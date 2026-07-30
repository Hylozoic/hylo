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
 * Shared drag-to-reorder handler for group views, so the edit list and the card
 * grid stay on one implementation of the ordering rules (home view at index 0,
 * insert-before semantics, optimistic local order with rollback on failure).
 *
 * The returned handler takes the dnd-kit event plus the list that was being
 * dragged, and applies the new order through `setLocalViews` before persisting.
 */
export default function useViewReorder (group) {
  const dispatch = useDispatch()

  return useCallback(async (event, listViews, targetGroupId, { setLocalViews, onReordered, parentGroupId } = {}) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = listViews.findIndex(v => String(v.id) === String(active.id))
    const newIndex = listViews.findIndex(v => String(v.id) === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const movedView = listViews[oldIndex]
    const finalOrder = arrayMove(listViews, oldIndex, newIndex)
    // External links (and other non-home types) cannot become the home view.
    if (!canBeHomeView(finalOrder[0])) return

    const params = getReorderParams(finalOrder, newIndex)
    const resolvedParentGroupId = parentGroupId || group?.id

    setLocalViews?.(finalOrder)
    onReordered?.(finalOrder)

    try {
      await persistViewReorder(dispatch, movedView, params, {
        parentGroupId: resolvedParentGroupId,
        targetGroupId,
        reorderedItems: finalOrder
      })
    } catch (error) {
      console.error('Failed to reorder views:', error)
      setLocalViews?.(listViews)
      onReordered?.(listViews)
      if (resolvedParentGroupId) {
        await dispatch(fetchGroupViews(resolvedParentGroupId))
      }
    }
  }, [dispatch, group?.id])
}
