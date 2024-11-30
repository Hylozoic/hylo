export function reorderTree ({ priorWidgetState = {}, newWidgetPosition, allWidgets }) {
  // Remove the old widget position
  const oldWidgetDetails = allWidgets.find(widget => widget.id === priorWidgetState?.id)
  let updatedWidgets = allWidgets.filter(widget => widget.id !== priorWidgetState?.id)
  let replacedWidget
  let oldPeers = []
  // Get the peers of the widget being moved
  if (priorWidgetState.order) {
    oldPeers = settle(getPeers(updatedWidgets, priorWidgetState))
  }
  updatedWidgets = updatedWidgets.map(widget => {
    const settledPeer = oldPeers.find(peer => peer.id === widget.id)
    return settledPeer || widget
  })

  if (newWidgetPosition.remove) {
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


function getPeers(widgets, widget) {
  if (widget.parentId) return widgets.filter(w => w.parentId === widget.parentId)
  return widgets.filter(w => !w.parentId && !!w.order)
}

function settle(items) {
  return items.sort((a, b) => a.order - b.order).map((item, index) => ({
    ...item,
    order: item.order !== index + 1 ? item.order - 1 : item.order
  }))
}
