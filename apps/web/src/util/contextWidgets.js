export function reorderTree ({ widgetToBeMovedId, newWidgetPosition, allWidgets }) {
  // Remove the old widget position
  const oldWidgetDetails = allWidgets.find(widget => widget.id === widgetToBeMovedId)

  let updatedWidgets = allWidgets.filter(widget => widget.id !== widgetToBeMovedId)
  let replacedWidget
  let oldPeers = []
  // Get the peers of the widget being moved
  if (oldWidgetDetails.order) {
    oldPeers = settle(getPeers(updatedWidgets, oldWidgetDetails))
  }
  updatedWidgets = updatedWidgets.map(widget => {
    const settledPeer = oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })

  if (newWidgetPosition.remove) {
    updatedWidgets.push({ ...oldWidgetDetails, order: null, parentId: null })
    return updatedWidgets
  }

  if (newWidgetPosition.orderInFrontOfWidgetId) {
    replacedWidget = updatedWidgets.find(widget => widget.id === newWidgetPosition.orderInFrontOfWidgetId)
  }

  let newPeers = replacedWidget ? getPeers(updatedWidgets, replacedWidget) : getPeers(updatedWidgets, newWidgetPosition)
  if (!replacedWidget) {
    const newOrder = newPeers.length > 0 ? newPeers.sort((a, b) => a.order - b.order)[newPeers.length - 1].order : 0
    newPeers.push({ ...oldWidgetDetails, id: newWidgetPosition.id, order: newOrder + 1, parentId: newWidgetPosition.parentId || null })
  } else {
    newPeers = newPeers.reduce((acc, widget) => {
      if (widget.order > replacedWidget.order) {
        acc.push({ ...widget, order: widget.order + 1 })
      } else if (widget.order === replacedWidget.order) {
        acc.push({ ...widget, order: widget.order + 1 })
        acc.push({ ...oldWidgetDetails, id: newWidgetPosition.id, order: widget.order, parentId: widget.parentId || null })
      } else {
        acc.push(widget)
      }
      return acc
    }, [])
  }

  return allWidgets.map(widget => {
    const settledPeer = newPeers.find(peer => peer.id === widget.id) || oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })
}
// TODO CONTEXT: add this to /shared
function getPeers (widgets, widget) {
  if (widget.parentId) return widgets.filter(w => w.parentId === widget.parentId)
  return widgets.filter(w => !w.parentId && !!w.order)
}
// TODO CONTEXT: add this to /shared
function settle (items) {
  return items.sort((a, b) => a.order - b.order).map((item, index) => ({
    ...item,
    order: item.order !== index + 1 ? item.order - 1 : item.order
  }))
}
// TODO CONTEXT: add this to /shared
function findHomeChild (widgets) {
  const homeParentId = widgets.find(widget => widget.type === 'home')?.id
  return { homeChild: widgets.find(widget => widget.parentId === homeParentId), homeParentId }
}

// TODO CONTEXT: add this to /shared
export function replaceHomeWidget ({ widgets, newHomeWidgetId }) {
  const { homeChild, homeParentId } = findHomeChild(widgets)
  const widgetToBeMoved = widgets.find(widget => widget.id === newHomeWidgetId)
  let updatedWidgets = widgets.filter(widget => {
    if (widget.id === newHomeWidgetId) return false
    if (homeChild && widget.id === homeChild.id) return false
    return true
  })

  let oldPeers = []
  // Get the peers of the widget being moved, and settle them
  if (widgetToBeMoved.order) {
    oldPeers = settle(getPeers(updatedWidgets, widgetToBeMoved))
  }

  updatedWidgets = updatedWidgets.map(widget => {
    const settledPeer = oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })

  // so by here the updatedWidgets array has removed the new home widget from its prior position and its prior peers are settled

  // if the old home widget is a chat, we need to move it to the top of the chats widget, otherwise we remove it from the menu
  if (homeChild.type === 'chat') {
    const chatsWidgetId = updatedWidgets.find(widget => widget.type === 'chats')?.id
    const newPeers = updatedWidgets.filter(widget => widget.parentId === chatsWidgetId).map(peer => ({
      ...peer,
      order: peer.order + 1
    }))

    updatedWidgets.push({
      ...homeChild,
      parentId: chatsWidgetId,
      order: 1
    })
    updatedWidgets = updatedWidgets.map(widget => newPeers.find(peer => peer.id === widget.id) || widget)
  } else {
    updatedWidgets.push({
      ...homeChild,
      order: null,
      parentId: null
    })
  }

  updatedWidgets.push({
    ...widgetToBeMoved,
    order: 1,
    parentId: homeParentId
  })
  return updatedWidgets
}
