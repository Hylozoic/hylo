import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'

// TODO CONTEXT: SHAREABLE CODE

export const getContextWidgets = ormCreateSelector(
  orm,
  (state, group) => group,
  (session, group) => {
    return group?.contextWidgets?.items || []
  }
)

export const orderContextWidgetsForContextMenu = (contextWidgets) => {
  // Step 1: Filter out widgets without an order, as these are not displayed in the context menu
  const orderedWidgets = contextWidgets.filter(widget => widget.order !== null)

  // Step 2: Split into parentWidgets and childWidgets
  const parentWidgets = orderedWidgets.filter(widget => !widget?.parentWidget?.id)
  const childWidgets = orderedWidgets.filter(widget => widget?.parentWidget?.id)

  // Step 3: Add an empty array for childWidgets to each parentWidget
  parentWidgets.forEach(parent => {
    parent.childWidgets = []
  })

  // Step 4: Append each childWidget to the appropriate parentWidget
  childWidgets.forEach(child => {
    const parent = parentWidgets.find(parent => parent.id === child?.parentWidget?.id)
    if (parent) {
      parent.childWidgets.push(child)
    }
  })

  // Step 5: Sort parentWidgets and each childWidgets array by order
  parentWidgets.sort((a, b) => a.order - b.order)
  parentWidgets.forEach(parent => {
    parent.childWidgets.sort((a, b) => a.order - b.order)
  })

  // Return the sorted parentWidgets with nested childWidgets
  return parentWidgets
}
