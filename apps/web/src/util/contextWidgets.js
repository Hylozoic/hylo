// These import/exports are included here just to have a central record of context widget utilities
export { widgetUrl } from './navigation'
export { default as useGatherItems } from 'hooks/useGatherItems'

export function widgetTitleResolver ({ widget, t }) {
  let title = widget.title
  if (title && title.startsWith('widget-')) {
    title = t(title)
  } else if (!title) {
    title = widget.viewGroup?.name || widget.viewUser?.name ||
            widget.viewPost?.title || widget.viewChat?.name ||
            widget.customView?.name || ''
  } else {
    title = title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  return title
}

// TODO CONTEXT: need to check if a widget has a set icon, a default icon based on type/view/etc or can fall back on to the icon/avatar of its child
export function widgetIconResolver () {

}

export function wrapItemInWidget (item, type) {
  return {
    [type]: item
  }
}

export function findHomeView (group) {
  if (!group?.contextWidgets) {
    throw new Error('Group has no contextWidgets')
  }
  const homeWidget = group.contextWidgets.items.find(w => w.type === 'home')
  return group.contextWidgets.items.find(w => w.parentWidget?.id === homeWidget.id)
}
