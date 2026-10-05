import { useSyncExternalStore } from 'react'

/** Legacy Hylo icon-font names stored on older views. */
const HYLO_TO_LUCIDE = {
  Filter: 'ListFilter',
  Stack: 'Layers'
}

let iconSet = null
let loading = null
const listeners = new Set()

/** Loads the full Lucide icon map once, in a separate chunk. */
export function loadLucideIcons () {
  if (iconSet) return Promise.resolve(iconSet)
  if (!loading) {
    loading = import('./lucideIconImports').then(mod => {
      iconSet = mod.icons
      listeners.forEach(listener => listener())
      return iconSet
    }).catch(err => {
      loading = null
      throw err
    })
  }
  return loading
}

/** The icon map after it has loaded, otherwise null. */
export function getLucideIcons () {
  return iconSet
}

/** Subscribes to the icon map finishing loading. */
export function subscribeLucideIcons (listener) {
  listeners.add(listener)
  loadLucideIcons()
  return () => listeners.delete(listener)
}

/** True once the icon map is available. */
export function useLucideIconsLoaded () {
  return useSyncExternalStore(subscribeLucideIcons, () => iconSet != null, () => false)
}

/** The icon map, re-rendering when it arrives. Null until then. */
export function useLucideIcons () {
  return useSyncExternalStore(subscribeLucideIcons, getLucideIcons, () => null)
}

/** Resolves a stored icon name to a Lucide component, or null if unknown or not loaded yet. */
export function resolveLucideIcon (name) {
  if (!name || !iconSet) return null
  if (iconSet[name]) return iconSet[name]
  const mapped = HYLO_TO_LUCIDE[name]
  if (mapped && iconSet[mapped]) return iconSet[mapped]
  return null
}
